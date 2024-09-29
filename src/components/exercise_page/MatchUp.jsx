import {
    closestCenter,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import _ from "lodash";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Col, Row, Spinner } from "react-bootstrap";
import { ArrowRightCircle, Check2Circle, VolumeUp, VolumeUpFill, XCircle } from "react-bootstrap-icons";
import { useTranslation } from "react-i18next";
import { ShuffleArray } from "../../utils/ShuffleArray";
import useCountdownTimer from "../../utils/useCountdownTimer";
import SortableWord from "./SortableWord";

const MatchUp = ({ quiz, timer, onAnswer, onQuit, setTimeIsUp }) => {
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
    const [shuffledQuiz, setShuffledQuiz] = useState([]);
    const [shuffledWords, setShuffledWords] = useState([]);
    const [audioItems, setAudioItems] = useState([]);
    const [isPlaying, setIsPlaying] = useState(null);
    const [isLoading, setIsLoading] = useState([]);
    const [isCorrectArray, setIsCorrectArray] = useState([]);
    const [buttonsDisabled, setButtonsDisabled] = useState(false);
    const [originalPairs, setOriginalPairs] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const { formatTime, clearTimer, startTimer } = useCountdownTimer(timer, () => setTimeIsUp(true));

    const audioRef = useRef(null);

    const { t } = useTranslation();

    const filterAndShuffleQuiz = useCallback((quiz) => {
        const uniqueQuiz = _.uniqWith(quiz, _.isEqual);
        return ShuffleArray(uniqueQuiz);
    }, []);

    const loadQuiz = useCallback((quizData) => {
        // Store the original pairs for checking answers
        const pairs = quizData.audio.map((audio, index) => ({
            audio: audio.src.split("_")[0].toLowerCase(),
            word: quizData.words[index].text.toLowerCase(),
        }));
        setOriginalPairs(pairs);

        // Generate unique IDs for each word
        const wordsWithIds = quizData.words.map((word, index) => ({
            ...word,
            id: `${word.text}-${index}-${Math.random().toString(36).substring(2, 11)}`,
        }));

        // Shuffle words and audio independently
        const shuffledWordsArray = ShuffleArray(wordsWithIds);
        const shuffledAudioArray = ShuffleArray(quizData.audio);

        setShuffledWords(shuffledWordsArray);
        setAudioItems(shuffledAudioArray);
        setIsCorrectArray(new Array(shuffledWordsArray.length).fill(null));
        setButtonsDisabled(false);
    }, []);

    useEffect(() => {
        if (quiz?.length > 0) {
            setShuffledQuiz(filterAndShuffleQuiz(quiz));
            setCurrentQuizIndex(0);
        }
    }, [quiz, filterAndShuffleQuiz]);

    useEffect(() => {
        if (shuffledQuiz.length > 0 && currentQuizIndex < shuffledQuiz.length) {
            loadQuiz(shuffledQuiz[currentQuizIndex]);
            setIsLoading(new Array(shuffledQuiz[currentQuizIndex].audio.length).fill(false));
        }
    }, [shuffledQuiz, currentQuizIndex, loadQuiz]);

    useEffect(() => {
        // Initialize the audioRef
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(TouchSensor, {
            // Prevent scrolling while dragging on touch devices
            preventScrolling: true,
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleAudioPlay = (src, index) => {
        // Pause the current audio if it's playing
        if (isPlaying !== null) {
            audioRef.current.pause();
            setIsPlaying(null);
        }

        // Reset all loading states before setting the new one
        setIsLoading((prev) => prev.map(() => false));

        // Start the new audio if it's not already playing
        if (isPlaying !== index) {
            const audioSrc = `${import.meta.env.BASE_URL}media/exercise/mp3/${src}.mp3`;
            audioRef.current.src = audioSrc; // Set the new audio source

            // Set loading state for this specific button
            setIsLoading((prev) => {
                const newLoadingState = [...prev];
                newLoadingState[index] = true;
                return newLoadingState;
            });

            audioRef.current.play().then(() => {
                setIsPlaying(index);
                startTimer();
                // Disable loading state for this specific button
                setIsLoading((prev) => {
                    const newLoadingState = [...prev];
                    newLoadingState[index] = false;
                    return newLoadingState;
                });
            });

            audioRef.current.onended = () => setIsPlaying(null);
            audioRef.current.onerror = () => {
                setIsPlaying(null);
                // Disable loading state in case of error
                setIsLoading((prev) => {
                    const newLoadingState = [...prev];
                    newLoadingState[index] = false;
                    return newLoadingState;
                });
                console.error("Error loading the audio file:", audioSrc);
                alert("There was an error loading the audio file. Please check your connection or try again later.");
            };
        }
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0; // Reset the audio to the start
            audioRef.current.removeAttribute("src"); // Remove the audio source attribute
            audioRef.current.load(); // Reload the audio element to reset the state
            setIsPlaying(false); // Reset the playing state
            setIsLoading(false);
        }
    };

    const handleDragStart = (event) => {
        const { active } = event;
        setActiveId(active.id);
        startTimer();
    };

    const handleDragEnd = ({ active, over }) => {
        setActiveId(null);

        if (active.id !== over.id) {
            setShuffledWords((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleSubmit = () => {
        let correctCount = 0;
        const updatedCorrectArray = [...isCorrectArray];

        shuffledWords.forEach((word, index) => {
            const audioSrc = audioItems[index].src.split("_")[0].toLowerCase();
            const wordText = word.text.toLowerCase();

            // Compare the shuffled pair with the original pair using the word text
            const isCorrect = originalPairs.some((pair) => pair.audio === audioSrc && pair.word === wordText);

            updatedCorrectArray[index] = isCorrect;

            if (isCorrect) {
                correctCount++;
            }
        });

        setIsCorrectArray(updatedCorrectArray);
        setButtonsDisabled(true);

        onAnswer(correctCount, "multiple", shuffledWords.length);
    };

    const handleNextQuiz = () => {
        if (!buttonsDisabled) {
            const updatedCorrectArray = new Array(shuffledWords.length).fill(false);
            setIsCorrectArray(updatedCorrectArray);
            onAnswer(0, "multiple", shuffledWords.length);
        }

        // Reset audio state and element
        stopAudio();

        if (currentQuizIndex < shuffledQuiz.length - 1) {
            setCurrentQuizIndex(currentQuizIndex + 1);
        } else {
            onQuit();
            stopAudio();
            clearTimer();
        }
    };

    const handleQuit = () => {
        onQuit();
        stopAudio();
        clearTimer();
    };

    return (
        <>
            <Card.Header className="fw-semibold">
                <div className="d-flex">
                    <div className="me-auto">
                        {t("exercise_page.questionNo")} #{currentQuizIndex + 1}
                    </div>
                    {timer > 0 && (
                        <div className="ms-auto">
                            {t("exercise_page.timer")} {formatTime()}
                        </div>
                    )}
                </div>
            </Card.Header>
            <Card.Body>
                <Row className="d-flex justify-content-center">
                    <Col xs={2} md={2} className="d-flex justify-content-end">
                        <div>
                            {audioItems.map((audio, index) => (
                                <div key={index} className="mb-3">
                                    <Button
                                        variant="primary"
                                        onClick={() => handleAudioPlay(audio.src, index)}
                                        disabled={isLoading[index]}>
                                        {isLoading[index] ? (
                                            <Spinner animation="border" size="sm" />
                                        ) : isPlaying === index ? (
                                            <VolumeUpFill />
                                        ) : (
                                            <VolumeUp />
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </Col>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        autoScroll={{ layoutShiftCompensation: false, enable: false }}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}>
                        <Col xs={6} md={4}>
                            <div className="d-flex justify-content-center flex-column flex-wrap gap-2">
                                <SortableContext
                                    items={shuffledWords.map((word) => word.id)}
                                    strategy={verticalListSortingStrategy}>
                                    {shuffledWords.map((word, index) => (
                                        <SortableWord
                                            key={word.id}
                                            word={word}
                                            index={index}
                                            isCorrect={isCorrectArray[index]}
                                            disabled={buttonsDisabled}
                                        />
                                    ))}
                                </SortableContext>
                                <DragOverlay>
                                    {activeId ? (
                                        <SortableWord
                                            word={{
                                                id: activeId,
                                                text: shuffledWords.find((item) => item.id === activeId)?.text,
                                            }}
                                            isOverlay={true} // Pass a prop to indicate it's in the overlay
                                        />
                                    ) : null}
                                </DragOverlay>
                            </div>
                        </Col>
                    </DndContext>
                </Row>

                <div className="d-flex justify-content-end mt-3">
                    <Button variant="success" onClick={handleSubmit} disabled={buttonsDisabled}>
                        <Check2Circle /> {t("exercise_page.buttons.checkBtn")}
                    </Button>
                    {currentQuizIndex < shuffledQuiz.length - 1 && (
                        <Button variant="secondary" className="ms-2" onClick={handleNextQuiz}>
                            <ArrowRightCircle /> {t("exercise_page.buttons.nextBtn")}
                        </Button>
                    )}
                    <Button variant="danger" className="ms-2" onClick={handleQuit}>
                        <XCircle /> {t("exercise_page.buttons.quitBtn")}
                    </Button>
                </div>
            </Card.Body>
        </>
    );
};

export default MatchUp;
