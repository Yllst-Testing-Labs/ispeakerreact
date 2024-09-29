import he from "he";
import { Card, Col, Row } from "react-bootstrap";
import { EmojiFrown, EmojiNeutral, EmojiSmile } from "react-bootstrap-icons";
import { useTranslation } from "react-i18next";

const ReviewCard = ({ sound, handleReviewClick, emojiStyle }) => {
    const { t } = useTranslation();

    return (
        <Card className="shadow-sm">
            <Card.Header className="fw-semibold">{t("sound_page.reviewCard")}</Card.Header>
            <Card.Body>
                <Card.Text>{t("sound_page.reviewInstructions", { phoneme: he.decode(sound.phoneme) })}</Card.Text>
                <Row className="d-flex justify-content-center">
                    <Col xs={"auto"} className="me-2" onClick={() => handleReviewClick("good")}>
                        <EmojiSmile size={52} role="button" className={`bi bi-emoji-smile ${emojiStyle("good")}`} />
                    </Col>
                    <Col xs={"auto"} className="me-2" onClick={() => handleReviewClick("neutral")}>
                        <EmojiNeutral
                            size={52}
                            role="button"
                            className={`bi bi-emoji-neutral ${emojiStyle("neutral")}`}
                        />
                    </Col>
                    <Col xs={"auto"} className="me-2" onClick={() => handleReviewClick("bad")}>
                        <EmojiFrown size={52} role="button" className={`bi bi-emoji-frown ${emojiStyle("bad")}`} />
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
};

export default ReviewCard;
