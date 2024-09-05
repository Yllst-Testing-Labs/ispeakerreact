import { useState, useEffect, useRef, useCallback } from "react";

const useCountdownTimer = (initialTime, onTimerEnd) => {
    const [remainingTime, setRemainingTime] = useState(initialTime * 60); // Track remaining time in state (seconds)
    const intervalIdRef = useRef(null); // Ref to store the interval ID
    const [isActive, setIsActive] = useState(false); // Control timer activation

    // Start the timer and keep it running every second
    const startTimer = useCallback(() => {
        if (!isActive && intervalIdRef.current === null) {
            setIsActive(true); // Activate the timer
            intervalIdRef.current = setInterval(() => {
                setRemainingTime((prevTime) => {
                    if (prevTime <= 1) {
                        clearInterval(intervalIdRef.current);
                        intervalIdRef.current = null;
                        onTimerEnd(); // Notify when time is up
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);
        }
    }, [isActive, onTimerEnd]);

    // Clear the timer when needed
    const clearTimer = useCallback(() => {
        if (intervalIdRef.current !== null) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }
        setIsActive(false); // Deactivate the timer
    }, []);

    // Format time into minutes and seconds
    const formatTime = useCallback(() => {
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    }, [remainingTime]);

    // Cleanup interval when the component unmounts
    useEffect(() => {
        return () => clearTimer();
    }, [clearTimer]);

    return { remainingTime, formatTime, clearTimer, startTimer, isActive };
};

export default useCountdownTimer;
