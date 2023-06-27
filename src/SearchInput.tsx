import { useEffect, useState } from 'react';

interface SearchInputProps {
    onSearchValueChange: (value: string) => void;
}

function SearchInput({ onSearchValueChange }: SearchInputProps) {
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        // Set a timeout to wait for user to stop typing
        const timer = setTimeout(() => {
            onSearchValueChange?.(inputValue);
        }, 500);

        // Cleanup the timer when the effect re-runs
        return () => clearTimeout(timer);
    }, [inputValue, onSearchValueChange]);

    return (
        <div className="Search">
            <input
                type="text"
                placeholder="Search"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
            />
        </div>
    );
}

export default SearchInput;