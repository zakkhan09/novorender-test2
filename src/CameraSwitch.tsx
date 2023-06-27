
interface CameraSwitchProps {
    count: number; // how many camera options to show
    onCameraSelected: (index: number) => void;
    onCameraSet: (index: number) => void;
}

function CameraSwitch({ count, onCameraSelected, onCameraSet }: CameraSwitchProps) {
    // on click select camera, on click with shift set camera

    return (
        <div className="CameraSwitch">
            {Array.from({ length: count }, (_, i) => (
                <button
                    key={i}
                    onClick={(e) => {
                        if (e.shiftKey) {
                            onCameraSet(i);
                        } else {
                            onCameraSelected(i);
                        }
                    }}
                >
                    {i+1}
                </button>
            ))}
        </div>
    );
}

export default CameraSwitch;