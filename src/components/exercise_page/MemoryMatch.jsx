import he from "he";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Col, Row } from "react-bootstrap";
import { CheckCircleFill, XCircle, XCircleFill } from "react-bootstrap-icons";
import { Flipped, Flipper } from "react-flip-toolkit";
import { useTranslation } from "react-i18next";
import "../../styles/memory-card.css";
import { ShuffleArray } from "../../utils/ShuffleArray";
import useCountdownTimer from "../../utils/useCountdownTimer";

const MemoryMatch = ({ quiz, timer, onQuit, setTimeIsUp, onMatchFinished }) => {
    const [shuffledQuiz, setShuffledQuiz] = useState([]);
    const [flippedCards, setFlippedCards] = useState([]);
    const [matchedCards, setMatchedCards] = useState([]);
    const [isChecking, setIsChecking] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [hasStarted, setHasStarted] = useState(false);
    const [currentMatchedPair, setCurrentMatchedPair] = useState([]);

    // Use the countdown timer
    const { formatTime, clearTimer, startTimer } = useCountdownTimer(timer, () => setTimeIsUp(true));

    const { t } = useTranslation();

    // Function to randomly pick 8 pairs from the entire quiz data
    const prepareQuiz = useCallback((quizData) => {
        // Step 1: Group pairs by their `value` within each object and assign a unique `id`
        let idCounter = 0; // To assign a unique identifier to each pair
        const groupedPairs = quizData.reduce((acc, quizItem) => {
            // Iterate over each item in the `data` array of each `quizItem`
            for (let i = 0; i < quizItem.data.length; i += 2) {
                const value = quizItem.data[i].value;
                const pair = quizItem.data.filter((item) => item.value === value).slice(0, 2); // Only take the first two
                if (pair.length === 2) {
                    acc.push({ id: idCounter++, pair }); // Add each pair with a unique `id`
                }
            }
            return acc;
        }, []);

        // Step 2: Shuffle the combined grouped pairs to randomize them
        const shuffledPairs = ShuffleArray([...groupedPairs]);

        // Step 3: Keep track of selected texts to avoid duplicates (but allow the same `value` across different pairs)
        const selectedTexts = new Set();
        const selectedPairs = [];

        // Step 4: Loop through the shuffled pairs and select 8 pairs, while filtering out pairs with duplicate texts
        for (const { id, pair } of shuffledPairs) {
            const [first, second] = pair;

            // Check if either text has already been used
            if (!selectedTexts.has(first.text) && !selectedTexts.has(second.text)) {
                // Add both texts to the selectedTexts set
                selectedTexts.add(first.text);
                selectedTexts.add(second.text);

                // Add the pair (with its id) to the selectedPairs array
                selectedPairs.push({ id, pair });

                // Stop once we have 8 pairs
                if (selectedPairs.length === 8) break;
            }
        }

        // Step 5: Duplicate and shuffle the selected pairs to form the memory match cards
        const quizCards = ShuffleArray(
            selectedPairs.flatMap(({ id, pair }, index) => [
                { ...pair[0], id: id * 2 }, // Create a unique id for each card based on the pair's unique `id`
                { ...pair[1], id: id * 2 + 1 }, // Duplicate the matching pair with a different id
            ])
        );

        // Step 6: Set the state with the new set of shuffled cards
        setShuffledQuiz(quizCards);
        setFlippedCards([]);
        setMatchedCards([]);
        setFeedback(null);
    }, []);

    // Prepare quiz data when the component loads
    useEffect(() => {
        if (quiz && quiz.length > 0) {
            prepareQuiz(quiz);
        }
    }, [quiz, prepareQuiz]);

    // Handle card click logic
    const handleCardClick = (card) => {
        if (!hasStarted) {
            setHasStarted(true);
            startTimer(); // Start the timer immediately on the first card click
        }

        if (flippedCards.length < 2 && !flippedCards.includes(card.id) && !matchedCards.includes(card.id)) {
            setFlippedCards((prev) => [...prev, card.id]);
        }
    };

    // Logic to check matching cards
    useEffect(() => {
        if (flippedCards.length === 2) {
            setIsChecking(true);
            setTimeout(() => {
                const [firstCardId, secondCardId] = flippedCards;
                const firstCard = shuffledQuiz.find((card) => card.id === firstCardId);
                const secondCard = shuffledQuiz.find((card) => card.id === secondCardId);

                // Compare using the pair's `id` instead of the `value`
                if (Math.floor(firstCard.id / 2) === Math.floor(secondCard.id / 2)) {
                    // Cards belong to the same pair, so it's a match
                    setMatchedCards((prev) => [...prev, firstCardId, secondCardId]);
                    setCurrentMatchedPair([firstCardId, secondCardId]);
                    setFeedback("success");
                } else {
                    // Cards do not belong to the same pair
                    setFeedback("danger");
                }

                setTimeout(() => {
                    setFlippedCards([]);
                    setIsChecking(false);
                    setFeedback(null);
                    setCurrentMatchedPair([]); // Clear current matched pair after feedback
                }, 1000);
            }, 1000);
        }
    }, [flippedCards, shuffledQuiz]);

    // Check if all matches are completed
    useEffect(() => {
        if (matchedCards.length === shuffledQuiz.length && shuffledQuiz.length > 0) {
            clearTimer();
            setTimeout(() => {
                if (onMatchFinished) onMatchFinished();
            }, 2000);
        }
    }, [matchedCards, shuffledQuiz, onMatchFinished, clearTimer]);

    // Handle quit action
    const handleQuit = () => {
        clearTimer();
        onQuit();
    };

    return (
        <>
            <Card.Header className="fw-semibold">
                <div className="d-flex">
                    <div className="me-auto">{t("exercise_page.memoryMatchHeading")}</div>
                    {timer > 0 && (
                        <div className="ms-auto">
                            {t("exercise_page.timer")} {formatTime()}
                        </div>
                    )}
                </div>
            </Card.Header>
            <Card.Body>
                <Flipper flipKey={flippedCards.concat(matchedCards)}>
                    <Row className="g-1 justify-content-center">
                        {shuffledQuiz.map((card, index) => (
                            <Col xs={3} md={3} key={index} className="d-flex justify-content-center">
                                <Flipped flipId={card.id}>
                                    <div
                                        onClick={() => handleCardClick(card)}
                                        className={`memory-card ${
                                            flippedCards.includes(card.id) || matchedCards.includes(card.id)
                                                ? "flipped"
                                                : ""
                                        } ${
                                            feedback && flippedCards.includes(card.id)
                                                ? `text-bg-${feedback} rounded-2`
                                                : ""
                                        }`}>
                                        <div className="card-inner">
                                            <div className="card-front"></div>
                                            <div className="card-back">
                                                {he.decode(card.text)}
                                                {feedback === "success" && currentMatchedPair.includes(card.id) && (
                                                    <CheckCircleFill className="feedback-icon" />
                                                )}
                                                {feedback === "danger" && flippedCards.includes(card.id) && (
                                                    <XCircleFill className="feedback-icon" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Flipped>
                            </Col>
                        ))}
                    </Row>
                </Flipper>
                <div className="d-flex justify-content-end mt-3">
                    <Button variant="danger" onClick={handleQuit}>
                        <XCircle /> {t("exercise_page.buttons.quitBtn")}
                    </Button>
                </div>
            </Card.Body>
        </>
    );
};

export default MemoryMatch;
