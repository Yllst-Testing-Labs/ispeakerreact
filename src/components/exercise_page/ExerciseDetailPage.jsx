import _ from "lodash";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Button, Card, Col, Collapse, Row } from "react-bootstrap";
import { ArrowCounterclockwise, ArrowLeftCircle, ChevronDown, ChevronUp } from "react-bootstrap-icons";
import { useTranslation } from "react-i18next";
import { isElectron } from "../../utils/isElectron";
import LoadingOverlay from "../general/LoadingOverlay";
import { getFileFromIndexedDB, saveFileToIndexedDB } from "../setting_page/offlineStorageDb";

// Lazy load the quiz components
const DictationQuiz = lazy(() => import("./DictationQuiz"));
const MatchUp = lazy(() => import("./MatchUp"));
const Reordering = lazy(() => import("./Reordering"));
const SoundAndSpelling = lazy(() => import("./SoundAndSpelling"));
const SortingExercise = lazy(() => import("./SortingExercise"));
const OddOneOut = lazy(() => import("./OddOneOut"));
const Snap = lazy(() => import("./Snap"));
const MemoryMatch = lazy(() => import("./MemoryMatch"));

const ExerciseDetailPage = ({ heading, id, title, accent, file, onBack }) => {
    const [instructions, setInstructions] = useState([]);
    const [quiz, setQuiz] = useState([]);
    const [split] = useState("");
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [score, setScore] = useState(0);
    const [totalAnswered, setTotalAnswered] = useState(0);
    const [currentExerciseType, setCurrentExerciseType] = useState("");
    const [timer, setTimer] = useState(null);
    const [timeIsUp, setTimeIsUp] = useState(false);
    const [onMatchFinished, setOnMatchFinished] = useState(false); // Track if all cards in Memory Match are matched

    const [openInstructions, setOpenInstructions] = useState(false);

    const [isloading, setIsLoading] = useState(true);

    const { t } = useTranslation();

    const getInstructionKey = (exerciseKey, exerciseId) => {
        if (exerciseKey === "sound_n_spelling") return `exercise_page.exerciseInstruction.sound_n_spelling.sound`;
        return `exercise_page.exerciseInstruction.${exerciseKey}.${exerciseId}`;
    };

    const fetchInstructions = useCallback(
        (exerciseKey, exerciseId, ipaSound) => {
            const instructionKey = getInstructionKey(exerciseKey, exerciseId);
            const instructions = t(instructionKey, { ipaSound: ipaSound || "", returnObjects: true });
            return Array.isArray(instructions) ? instructions : []; // Ensure it's always an array
        },
        [t]
    );

    // Helper function to handle the exercise data logic (setting quiz, instructions, etc.)
    const handleExerciseData = useCallback(
        (exerciseDetails, data, exerciseKey) => {
            const savedSettings = JSON.parse(localStorage.getItem("ispeaker"));
            const timerValue =
                exerciseKey === "memory_match"
                    ? savedSettings?.timerSettings?.memory_match || 4 // Use a default value for memory match
                    : (savedSettings?.timerSettings?.enabled === true && savedSettings?.timerSettings?.[exerciseKey]) ||
                      0; // For other exercises

            setTimer(timerValue);

            let selectedAccentData;
            let combinedQuizzes = [];

            const ipaSound = (exerciseKey === "sound_n_spelling" && exerciseDetails.exercise.trim()) || "";
            const loadInstructions = fetchInstructions(exerciseKey, id, ipaSound);

            if (id === "random") {
                data[exerciseKey].forEach((exercise) => {
                    if (exercise.id !== "random") {
                        if (exercise.british_american) {
                            selectedAccentData = exercise.british_american[0];
                        } else {
                            selectedAccentData =
                                accent === "American English" ? exercise.american?.[0] : exercise.british?.[0];
                        }

                        if (selectedAccentData) {
                            combinedQuizzes.push(
                                ...selectedAccentData.quiz.map((quiz) => ({
                                    ...quiz,
                                    split: exercise.split,
                                }))
                            );
                        }
                    }
                });

                const uniqueShuffledCombinedQuizzes = _.shuffle(
                    Array.from(new Set(combinedQuizzes.map(JSON.stringify))).map(JSON.parse)
                );
                setQuiz(uniqueShuffledCombinedQuizzes);

                if (exerciseDetails.british_american) {
                    selectedAccentData = exerciseDetails.british_american[0];
                } else {
                    selectedAccentData =
                        accent === "American English" ? exerciseDetails.american?.[0] : exerciseDetails.british?.[0];
                }

                setInstructions(loadInstructions || selectedAccentData?.instructions);
            } else {
                if (exerciseDetails.british_american) {
                    selectedAccentData = exerciseDetails.british_american[0];
                } else {
                    selectedAccentData =
                        accent === "American English" ? exerciseDetails.american?.[0] : exerciseDetails.british?.[0];
                }

                if (selectedAccentData) {
                    setInstructions(loadInstructions || selectedAccentData.instructions);
                    setQuiz(
                        selectedAccentData.quiz.map((quiz) => ({
                            ...quiz,
                            split: exerciseDetails.split,
                        }))
                    );
                }
            }
        },
        [accent, id, fetchInstructions]
    );

    const fetchExerciseData = useCallback(async () => {
        try {
            setIsLoading(true);

            // Check if the app is not running in Electron and try to fetch data from IndexedDB
            if (!isElectron()) {
                const cachedDataBlob = await getFileFromIndexedDB(`${file}`, "json");

                if (cachedDataBlob) {
                    // Convert Blob to text, then parse the JSON
                    const cachedDataText = await cachedDataBlob.text();
                    const cachedData = JSON.parse(cachedDataText);

                    const exerciseKey = file.replace("exercise_", "").replace(".json", "");
                    const exerciseDetails = cachedData[exerciseKey]?.find((exercise) => exercise.id === id);

                    setCurrentExerciseType(exerciseKey);

                    if (exerciseDetails) {
                        handleExerciseData(exerciseDetails, cachedData, exerciseKey);
                    }

                    setIsLoading(false);
                    return; // Early return if data is served from cache
                }
            }

            // If no cache or in Electron, fetch data from the network
            const response = await fetch(`${import.meta.env.BASE_URL}json/${file}`);
            if (!response.ok) {
                throw new Error("Failed to fetch exercise data");
            }

            const data = await response.json();
            const exerciseKey = file.replace("exercise_", "").replace(".json", "");
            const exerciseDetails = data[exerciseKey]?.find((exercise) => exercise.id === id);

            // Save fetched data to IndexedDB (excluding Electron)
            if (!isElectron()) {
                const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
                await saveFileToIndexedDB(`${file}`, blob, "json");
            }

            setCurrentExerciseType(exerciseKey);

            if (exerciseDetails) {
                handleExerciseData(exerciseDetails, data, exerciseKey);
            }
        } catch (error) {
            console.error("Error fetching exercise data:", error);
            alert("Error loading exercise data. Please check your Internet connection.");
        } finally {
            setIsLoading(false);
        }
    }, [id, file, handleExerciseData]);

    useEffect(() => {
        fetchExerciseData();
    }, [fetchExerciseData]);

    const handleAnswer = (correctCountOrBoolean, quizType = "single", quizAnswerNum = 1) => {
        if (quizType === "single") {
            // For single answer quizzes like DictationQuiz
            setTotalAnswered((prev) => prev + 1);
            if (correctCountOrBoolean) {
                setScore((prev) => prev + 1);
            }
        } else if (quizType === "multiple") {
            // For multiple answer quizzes like MatchUp
            setTotalAnswered((prev) => prev + quizAnswerNum);
            setScore((prev) => prev + correctCountOrBoolean);
        }
    };

    const handleQuizQuit = () => {
        setQuizCompleted(true);
        setTimeIsUp(false);
    };

    const handleQuizRestart = () => {
        setScore(0);
        setTotalAnswered(0);
        setQuizCompleted(false);
        setTimeIsUp(false);
        setOnMatchFinished(false);
    };

    const handleMatchFinished = () => {
        setOnMatchFinished(true); // Set match finished to true when all cards are revealed
    };

    const getEncouragementMessage = () => {
        if (totalAnswered === 0)
            return (
                <>
                    {t("exercise_page.encouragementMsg.level0")} <span className="noto-color-emoji">🚀</span>
                </>
            );
        const percentage = (score / totalAnswered) * 100;

        if (percentage === 100) {
            return (
                <>
                    {t("exercise_page.encouragementMsg.level6")} <span className="noto-color-emoji">🎉</span>
                </>
            );
        } else if (percentage >= 80) {
            return (
                <>
                    {t("exercise_page.encouragementMsg.level5")} <span className="noto-color-emoji">👍</span>
                </>
            );
        } else if (percentage >= 60) {
            return (
                <>
                    {t("exercise_page.encouragementMsg.level4")} <span className="noto-color-emoji">😊</span>
                </>
            );
        } else if (percentage >= 40) {
            return (
                <>
                    {t("exercise_page.encouragementMsg.level3")} <span className="noto-color-emoji">💪</span>
                </>
            );
        } else if (percentage >= 20) {
            return (
                <>
                    {t("exercise_page.encouragementMsg.level2")} <span className="noto-color-emoji">🌱</span>
                </>
            );
        } else {
            return (
                <>
                    {t("exercise_page.encouragementMsg.level1")} <span className="noto-color-emoji">🛤️</span>
                </>
            );
        }
    };

    const encouragementMessage = quizCompleted && totalAnswered > 0 ? getEncouragementMessage() : null;

    const renderQuizComponent = () => {
        // Remove "exercise_" prefix and ".json" suffix
        const exerciseType = file.replace("exercise_", "").replace(".json", "");

        const componentsMap = {
            dictation: DictationQuiz,
            matchup: MatchUp,
            reordering: Reordering,
            sound_n_spelling: SoundAndSpelling,
            sorting: SortingExercise,
            odd_one_out: OddOneOut,
            snap: Snap,
            memory_match: MemoryMatch,
        };

        const QuizComponent = componentsMap[exerciseType];

        return (
            <Suspense fallback={<LoadingOverlay />}>
                {QuizComponent ? (
                    <QuizComponent
                        quiz={quiz}
                        instructions={instructions}
                        onAnswer={handleAnswer}
                        onQuit={handleQuizQuit}
                        {...(exerciseType === "reordering" ? { split } : {})} // Pass `split` prop for reordering
                        timer={timer}
                        setTimeIsUp={setTimeIsUp}
                        onMatchFinished={handleMatchFinished}
                    />
                ) : (
                    <Card.Body>This quiz type is not yet implemented.</Card.Body>
                )}
            </Suspense>
        );
    };

    return (
        <>
            {isloading ? (
                <LoadingOverlay />
            ) : (
                <>
                    <h3 className="mt-4">{t(heading)}</h3>
                    <Row className="mt-2 g-4">
                        <Col md={4}>
                            <Card className="h-100 shadow-sm">
                                <Card.Header className="fw-semibold">{title}</Card.Header>
                                <Card.Body>
                                    <p>
                                        <strong>{t("accent.accentSettings")}:</strong>{" "}
                                        {accent === "American English"
                                            ? t("accent.accentAmerican")
                                            : t("accent.accentBritish")}
                                    </p>

                                    <div>
                                        <Button
                                            variant="info"
                                            onClick={() => setOpenInstructions(!openInstructions)}
                                            aria-controls="instructions-collapse"
                                            aria-expanded={openInstructions}>
                                            {openInstructions
                                                ? t("exercise_page.buttons.collapseBtn")
                                                : t("exercise_page.buttons.expandBtn")}{" "}
                                            {openInstructions ? <ChevronUp /> : <ChevronDown />}
                                        </Button>
                                        <Collapse in={openInstructions}>
                                            <div id="instructions-collapse">
                                                <Card body className="mt-2">
                                                    {instructions &&
                                                    Array.isArray(instructions) &&
                                                    instructions.length > 0 ? (
                                                        instructions.map((instruction, index) => (
                                                            <p
                                                                key={index}
                                                                className={
                                                                    index === instructions.length - 1 ? "mb-0" : ""
                                                                }>
                                                                {instruction}
                                                            </p>
                                                        ))
                                                    ) : (
                                                        <p className="mb-0">
                                                            [Instructions for this type of exercise is not yet
                                                            translated. Please update accordingly.]
                                                        </p>
                                                    )}
                                                </Card>
                                            </div>
                                        </Collapse>
                                    </div>

                                    <Button className="mb-2 mt-4" variant="primary" onClick={onBack}>
                                        <ArrowLeftCircle /> {t("exercise_page.buttons.backBtn")}
                                    </Button>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col md={8}>
                            <Card className="shadow-sm">
                                {timeIsUp || quizCompleted || onMatchFinished ? (
                                    <>
                                        <Card.Header className="fw-semibold">
                                            {t("exercise_page.result.cardHeading")}
                                        </Card.Header>
                                        <Card.Body>
                                            {onMatchFinished ? <p>{t("exercise_page.result.matchUpFinished")}</p> : ""}
                                            {timeIsUp && !onMatchFinished ? (
                                                <p>{t("exercise_page.result.timeUp")}</p>
                                            ) : (
                                                ""
                                            )}
                                            {score === 0 &&
                                            totalAnswered === 0 &&
                                            currentExerciseType !== "memory_match" ? (
                                                <p>{t("exercise_page.result.notAnswered")}</p>
                                            ) : currentExerciseType !== "memory_match" ? (
                                                <>
                                                    <p>
                                                        {t("exercise_page.result.answerResult", {
                                                            score,
                                                            totalAnswered,
                                                        })}
                                                    </p>
                                                    <p>{encouragementMessage}</p>
                                                    <p>{t("exercise_page.result.answerBottom")}</p>
                                                </>
                                            ) : (
                                                <p>{t("exercise_page.buttons.answerBottom")}</p>
                                            )}
                                            <Button variant="secondary" onClick={handleQuizRestart}>
                                                <ArrowCounterclockwise /> {t("exercise_page.buttons.restartBtn")}
                                            </Button>
                                        </Card.Body>
                                    </>
                                ) : (
                                    <>{renderQuizComponent()}</>
                                )}
                            </Card>

                            {timeIsUp || quizCompleted || currentExerciseType == "memory_match" ? (
                                ""
                            ) : (
                                <Card className="mt-4 shadow-sm">
                                    <Card.Header className="fw-semibold">Review</Card.Header>
                                    <Card.Body>
                                        {score === 0 && totalAnswered === 0 ? (
                                            ""
                                        ) : (
                                            <p>{t("exercise_page.result.answerResult", { score, totalAnswered })}</p>
                                        )}

                                        <p>{getEncouragementMessage()}</p>

                                        {score === 0 && totalAnswered === 0 ? (
                                            ""
                                        ) : (
                                            <p>{t("exercise_page.result.tryAgainBottom")}</p>
                                        )}
                                    </Card.Body>
                                </Card>
                            )}
                        </Col>
                    </Row>
                </>
            )}
        </>
    );
};

export default ExerciseDetailPage;
