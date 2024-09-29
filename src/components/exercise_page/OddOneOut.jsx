import he from "he";
import _ from "lodash";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Col, Row } from "react-bootstrap";
import { ArrowRightCircle, Check2Circle, CheckCircleFill, XCircle, XCircleFill } from "react-bootstrap-icons";
import { ShuffleArray } from "../../utils/ShuffleArray";
import useCountdownTimer from "../../utils/useCountdownTimer";
import { useTranslation } from "react-i18next";

const OddOneOut = ({ quiz, onAnswer, onQuit, timer, setTimeIsUp }) => {
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
    const [shuffledQuiz, setShuffledQuiz] = useState([]);
    const [shuffledOptions, setShuffledOptions] = useState([]);
    const [selectedOption, setSelectedOption] = useState(null);
    const [buttonsDisabled, setButtonsDisabled] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const { formatTime, clearTimer, startTimer } = useCountdownTimer(timer, () => setTimeIsUp(true));

    const { t } = useTranslation();

    useEffect(() => {
        if (timer > 0) {
            startTimer();
        }
    }, [timer, startTimer]);

    const filterAndShuffleQuiz = useCallback((quiz) => {
        const uniqueQuiz = _.uniqWith(quiz, _.isEqual);
        return ShuffleArray(uniqueQuiz);
    }, []);

    const loadQuiz = useCallback((quizData) => {
        const shuffledOptions = ShuffleArray([...quizData.data]);
        setShuffledOptions(shuffledOptions);
        setSelectedOption(null);
        setButtonsDisabled(false);
        setSubmitted(false);
    }, []);

    useEffect(() => {
        if (quiz && quiz.length > 0) {
            const shuffledQuizArray = filterAndShuffleQuiz([...quiz]);
            setShuffledQuiz(shuffledQuizArray);
            loadQuiz(shuffledQuizArray[currentQuizIndex]);
        }
    }, [quiz, currentQuizIndex, loadQuiz, filterAndShuffleQuiz]);

    const handleOptionClick = (index) => {
        setSelectedOption(index);
    };

    const handleSubmit = () => {
        if (selectedOption === null) return; // Ensure an option is selected

        const isCorrect = shuffledOptions[selectedOption].answer === "true";
        setButtonsDisabled(true);
        setSubmitted(true);
        onAnswer(isCorrect ? 1 : 0, "single");
    };

    const handleNextQuiz = () => {
        if (currentQuizIndex < shuffledQuiz.length - 1) {
            setCurrentQuizIndex((prevIndex) => prevIndex + 1);
        } else {
            onQuit();
            clearTimer();
        }
    };

    const handleQuit = () => {
        onQuit();
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
                <Row className="d-flex justify-content-center g-3">
                    {shuffledOptions.map((option, index) => (
                        <Col xs={12} md={6} key={index} className="d-flex justify-content-center">
                            <Button
                                variant={
                                    submitted && selectedOption === index
                                        ? option.answer === "true"
                                            ? "success"
                                            : "danger"
                                        : selectedOption === index
                                        ? "secondary"
                                        : "outline-secondary"
                                }
                                size="lg"
                                className={`fw-bold w-100 text-center p-3${buttonsDisabled ? " pe-none" : ""}${
                                    submitted && option.answer === "true" && selectedOption !== index
                                        ? " text-warning"
                                        : ""
                                }`}
                                onClick={() => handleOptionClick(index)}>
                                {he.decode(option.value)}
                                {submitted ? (
                                    submitted && option.answer === "true" ? (
                                        <CheckCircleFill className="ms-2" />
                                    ) : (
                                        <XCircleFill className="ms-2" />
                                    )
                                ) : (
                                    ""
                                )}
                            </Button>
                        </Col>
                    ))}
                </Row>
                <div className="d-flex justify-content-end mt-3">
                    <Button
                        variant="success"
                        onClick={handleSubmit}
                        disabled={selectedOption === null || buttonsDisabled}>
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

export default OddOneOut;
