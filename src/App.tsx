import {useEffect, useRef, useState} from 'react';
import {API, createAPI, Scene, View} from '@novorender/webgl-api';
import { API as DataAPI, createAPI as createDataAPI } from "@novorender/data-js-api";
import './App.css';
import SearchInput from "./SearchInput.tsx";
import CameraSwitch from "./CameraSwitch.tsx";

const SCENE_ID = '3b5e65560dc4422da5c7c3f827b6a77c';

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const apiRef = useRef<API | null>(null);
    const viewRef = useRef<View | null>(null);
    const [ searchValue, setSearchValue ] = useState("");
    const [ scene, setScene ] = useState<Scene | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const abortController = new AbortController();

        const dataApi = createDataAPI({
            serviceUrl: "https://data.novorender.com/api",
        });

        const api = createAPI({
            scriptBaseUrl: `${window.location.origin}/novorender/webgl-api/`,
        });
        apiRef.current = api;

        const mainRenderLoop = async (api: API, canvas: HTMLCanvasElement) => {
            try {
                const view = await loadSceneAndInitView(api, dataApi, canvas, SCENE_ID);
                if (abortController.signal.aborted) return;
                if (!view.scene) {
                    // todo: handle error, show error message on the screen
                    console.error('Scene is not loaded');
                    return;
                }

                setScene(view.scene);
                viewRef.current = view;

                // Handle canvas resizes
                const resizeObserver = new ResizeObserver((entries) => {
                    for (const entry of entries) {
                        canvas.width = entry.contentRect.width;
                        canvas.height = entry.contentRect.height;
                        view.applySettings({
                            display: { width: canvas.width, height: canvas.height },
                        });
                    }
                });

                resizeObserver.observe(canvas);

                const ctx = canvas.getContext('bitmaprenderer');

                const renderFrame = async () => {
                    if (abortController.signal.aborted) {
                        resizeObserver.disconnect();
                        return;
                    }

                    const { clientWidth, clientHeight } = canvas;
                    view.applySettings({
                        display: { width: clientWidth, height: clientHeight },
                    });

                    const output = await view.render();
                    const image = await output.getImage();
                    if (image) {
                        ctx?.transferFromImageBitmap(image);
                        image.close();
                    }

                    requestAnimationFrame(renderFrame);
                };

                renderFrame();
            } catch (error) {
                console.error('An error occurred:', error);
            }
        };

        mainRenderLoop(api, canvasRef.current);

        return () => {
            abortController.abort();

            // Additional cleanup, if necessary, goes here
            apiRef.current?.dispose();

            abortControllerRef.current = null;
            apiRef.current = null;
            viewRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!scene) return;

        const abortController = new AbortController();

        searchAndHighlightObjects(scene, searchValue, abortController);

        return () => {
            abortController.abort();
        }
    }, [ searchValue, scene ]);

    const onCameraSelected = (index: number) => {
        // get camera position and rotation from local storage by index
        const positionString = localStorage.getItem(`camera-${index}-position`);
        const rotationString = localStorage.getItem(`camera-${index}-rotation`);
        if (!positionString || !rotationString) {
            console.warn('Camera position or rotation is not found');
            return;
        }
        const position = JSON.parse(positionString);
        const rotation = JSON.parse(rotationString);

        // then moveTo
        if (!viewRef.current) {
            console.error('View is not initialized');
            return;
        }

        viewRef.current.camera.controller.moveTo(position, rotation);
    }

    const onCameraSet = (index: number) => {
        if (!viewRef.current) {
            console.error('View is not initialized');
            return;
        }
        // store camera position and rotation in local storage by index
        const position = viewRef.current.camera.position;
        localStorage.setItem(`camera-${index}-position`, JSON.stringify(position));

        const rotation = viewRef.current.camera.rotation;
        localStorage.setItem(`camera-${index}-rotation`, JSON.stringify(rotation));
    }

    return (
        <div className="App">
            <SearchInput onSearchValueChange={setSearchValue} />
            <CameraSwitch count={4} onCameraSelected={onCameraSelected} onCameraSet={onCameraSet} />
            <canvas ref={canvasRef}></canvas>
        </div>
    );
}

async function loadSceneAndInitView(api:API, dataApi:DataAPI, canvas:HTMLCanvasElement, sceneId:string) {
    // Load scene metadata
    const sceneData = await dataApi
        // Condos scene ID, but can be changed to any scene ID
        .loadScene(sceneId)
        .then((res) => {
            if ("error" in res) {
                throw res;
            } else {
                return res;
            }
        });

    // Destructure relevant properties into variables
    const { url, db, settings, camera: cameraParams } = sceneData;

    // Load scene / Create a view with the scene's saved settings
    const [ scene, view ] = await Promise.all([
        api.loadScene(url, db),
        api.createView(settings, canvas)
    ]);

    // Set resolution scale to 1
    view.applySettings({ quality: { resolution: { value: 1 } } });

    // Create a camera controller with the saved parameters with turntable as fallback
    if (cameraParams) {
        view.camera.controller = api.createCameraController(cameraParams as any, canvas);
    } else {
        view.camera.controller = api.createCameraController({ kind: "turntable" });
    }

    // Assign the scene to the view
    view.scene = scene;

    return view;
}

async function searchAndHighlightObjects(scene: Scene, searchValue: string, abortController: AbortController) {
    console.log('Search for', searchValue);
    if (!searchValue) {
        // If the search value is empty, set highlight to 0 (neutral) for all objects
        highlightFoundObjects(scene, []);
        return [];
    }

    // handle search value change
    // Run the searches
    // Fluffy search which will search all properties for words starting with "Roof"
    // "Roo" will still find roofs, but "oof" will not
    const iterator = scene.search({ searchPattern: searchValue });

    // In this example we just want to isolate the objects so all we need is the object ID
    const result: number[] = [];
    for await (const object of iterator) {
        // Check if the search was aborted
        if (abortController.signal.aborted) return [];

        result.push(object.id);
    }
    console.log('Found objects', result);

    // highlightFoundObjects
    highlightFoundObjects(scene, result);

    return result;
}

function highlightFoundObjects(scene: Scene, ids: number[]): void {
    if (ids.length === 0) {
        // If no objects are found, set highlight to 0 (neutral) for all objects
        scene.objectHighlighter.objectHighlightIndices.fill(0);
        scene.objectHighlighter.commit();
        return;
    }

    // Set highlight to 255 (transparent) for all objects
    scene.objectHighlighter.objectHighlightIndices.fill(255);

    // Set highlight back to 0 for objects to be visible
    ids.forEach((id) => {
        scene.objectHighlighter.objectHighlightIndices[id] = 0
    });

    scene.objectHighlighter.commit();
}

export default App;
