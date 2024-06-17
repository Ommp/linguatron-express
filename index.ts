import express, { Express, Request, Response, response } from "express";
// import path from "path";

import bodyParser from "body-parser";

import { Database } from "bun:sqlite";

import cors from 'cors';


const app: Express = express();

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

interface Deck {
  deck_id: number,
  deckname: string
}
interface Card {
  deck_id: number,
  card_id: number,
  answer: string,
  question: string,
  last_review_date: string,
  review_due_date: string,
  card_created: string,
  stage: string,
  ease: number,
  correct: number,
  incorrect: number,
  lapses: number
}


const db = new Database("mydb.sqlite");
db.exec("PRAGMA journal_mode = WAL;");

function createCardsTable() {
  return db.query("CREATE TABLE IF NOT EXISTS cards (card_id INTEGER PRIMARY KEY, deck_id INTEGER, correct INTEGER DEFAULT 0, incorrect INTEGER DEFAULT 0, card_created TEXT, last_review_date TEXT, stage TEXT DEFAULT learning, lapses INTEGER DEFAULT 0, ease REAL DEFAULT 1.00, review_due_date TEXT, question TEXT, answer TEXT, FOREIGN KEY (deck_id) REFERENCES decks(deck_id) ON DELETE CASCADE)");
}

function createDecksTable() {
  return db.query("CREATE TABLE IF NOT EXISTS decks (deck_id INTEGER PRIMARY KEY, deckname TEXT)");
}

createCardsTable().run();
createDecksTable().run();

const selectAllDecks = db.query("select * from decks");

const selectDeckByID = db.prepare("SELECT deck_id, deckname from decks WHERE deck_id = ?");
const selectAllCardsByDeckID = db.prepare("SELECT * from cards WHERE deck_id = ?");
const selectCardByCardID = db.prepare("SELECT * from cards WHERE card_id = ?");
const selectLearningCardsByDeckID = db.prepare("SELECT * from cards WHERE deck_id = ? AND stage = 'learning'");
const selectReviewCardsByDeckID = db.prepare("SELECT * from cards WHERE deck_id = ? AND stage = 'review'");
const updateLearningCard = db.prepare("UPDATE cards SET correct = ?, incorrect = ?, ease = ?, stage = ?, review_due_date = ?, last_review_date = ?  WHERE card_id = ?")
const updateReviewCard = db.prepare("UPDATE cards SET correct = ?, incorrect = ?, ease = ?, lapses = ?, last_review_date = ?, review_due_date = ? WHERE card_id = ?");




const insertCard = db.prepare("INSERT INTO cards (deck_id, question, answer, card_created) VALUES ($deck_id, $question, $answer, $card_created)");
const insertDeck = db.prepare("INSERT INTO decks (deckname) VALUES ($deckname)");
const deleteDeck = db.query("DELETE FROM decks WHERE deck_id = ?");
const deleteCard = db.query("DELETE FROM cards WHERE card_id = ?");


function getNextEaseLevel(currentEase: number) {
  // Check for initial value (1)
  if (currentEase === 1) {
    return 2;
  }
  // Formula for sequence: 0.5 * n^2 + 0.5 * n + 1 (n = position in sequence)
  const position = Math.sqrt(currentEase - 1) + 1; // Find position based on current ease
  return 0.5 * Math.pow(position, 2) + 0.5 * position + 1;
}


//API
app.get('/api/decks', (req, res) => {
  let decks = <Array<Deck>>selectAllDecks.all();
  // console.log(decks);
  res.json(decks);
});
app.get('/api/deck/:deck_id', async (req, res) => {
  const deck = selectDeckByID.get(Number(req.params.deck_id));
  res.json(deck);
});
app.get('/api/deck/:deck_id/cards', async (req, res) => {
  const deck = <Deck>selectDeckByID.get(Number(req.params.deck_id));

  const cards = <Array<Card>>selectAllCardsByDeckID.all(deck.deck_id);

  res.json(cards);
});
//Retrieve and return learning cards in random order for a given deck
app.get('/api/deck/:deck_id/randomlearningcards', async (req, res) => {
  const deck = <Deck>selectDeckByID.get(Number(req.params.deck_id));

  const cards = <Array<Card>>selectLearningCardsByDeckID.all(deck.deck_id);

  cards.sort(() => Math.random() - 0.5);

  const randomCards = cards.slice(0, Math.min(cards.length, 10));

  res.json(randomCards);
});
//Retrieve and return review cards in random order for a given deck
app.get('/api/deck/:deck_id/randomreviewcards', async (req, res) => {
  const deck = <Deck>selectDeckByID.get(Number(req.params.deck_id));

  const cards = <Array<Card>>selectReviewCardsByDeckID.all(deck.deck_id);
  const dueCards = <Array<Card>>[];

  for (let card = 0; card < cards.length; card++) {
    const element = cards[card];

    const currentDate = new Date();
    const reviewDueDate = new Date(element.review_due_date);

    if (reviewDueDate <= currentDate) {
      dueCards.push(element);
      // console.log(element);
    }
  }

  // cards.sort(() => Math.random() - 0.5);

  // const randomCards = cards.slice(0, Math.min(cards.length, 10));

  res.json(dueCards);
});
//Retrieve and return random cards for multiple choice answers
app.get('/api/deck/:deck_id/multiplechoicecards/:card_id', async (req, res) => {
  const deck = <Deck>selectDeckByID.get(Number(req.params.deck_id));

  const correctCard = <Card>selectCardByCardID.get(Number(req.params.card_id));

  const cards = <Array<Card>>selectAllCardsByDeckID.all(deck.deck_id);

  const randomCards = new Map();

  randomCards.set(correctCard.card_id, correctCard);

  while (randomCards.size < 4) {
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    console.log("random card" + randomCard.card_id);
    randomCards.set(randomCard.card_id, randomCard);
    console.log(randomCards.size);
  }

  const randomCardsArray = Array.from(randomCards.values());

  randomCardsArray.sort(() => Math.random() - 0.5);

  console.log(randomCardsArray);
  res.json(randomCardsArray);
});



// db.prepare("UPDATE cards SET correct = ?, incorrect = ?, ease = ?, stage = ?, review_due_date = ?, last_review_date = ?  WHERE card_id = ?")


//UPDATE learning card after a user has answered
app.put('/api/learning/updatecard', async (req, res) => {

  try {
    if (req.body.answer != null && req.body.card_id != null) {


      const lastReviewDateString = req.body.last_review_date;
      const DateForDueDate = new Date(lastReviewDateString);

      const answer = <String>req.body.answer.toLowerCase();
      const card_id = <number>req.body.card_id;

      const card = <Card>selectCardByCardID.get(card_id);
      res.send(`{"status": "correct_in_a_row received is: ${req.body.correct_in_a_row}, card id received is: ${req.body.card_id}"}`);

      //if answer correct two times in a row, set stage to review
      if (answer == card.answer.toLowerCase() && req.body.correct_in_a_row == 2) {
        DateForDueDate.setUTCDate(DateForDueDate.getUTCDate() + 1);
        updateLearningCard.run([
          card.correct + 1,
          card.incorrect,
          getNextEaseLevel(card.ease),
          "review",
          DateForDueDate.toISOString(),
          req.body.last_review_date,
          card_id,
        ] as any)
      } 
      //wrong answer
      else if (answer !== card.answer.toLowerCase() && card_id != null) {
        updateLearningCard.run([
          card.correct,
          card.incorrect + 1,
          1 /*ease */,
          "learning",
          DateForDueDate.toISOString(),
          req.body.last_review_date,
          card_id,
        ] as any);
      }

      else /* one correct */{
        updateLearningCard.run([
          card.correct + 1,
          card.incorrect,
          1,
          "learning",
          DateForDueDate.toISOString(),
          req.body.last_review_date,
          card_id,
      ] as any)
      }


      res.send(`{"status": "success"}`);
    } else {
      res.send("missing deck name");
    }

  } catch (error) {
    console.error(error);
    res.json(error);
  }

});

// "UPDATE cards SET correct = ?, incorrect = ?, ease = ?, lapses = ?, review_due_date = ? WHERE card_id = ?"

//UPDATE review card after a user has answered
app.put('/api/review/updatecard', async (req, res) => {

  try {
    if (req.body.answer != null && req.body.card_id != null) {

      const lastReviewDateString = req.body.last_review_date;
      const DateForDueDate = new Date(lastReviewDateString);

      const answer = <String>req.body.answer.toLowerCase();
      const card_id = <number>req.body.card_id;

      const card = <Card>selectCardByCardID.get(card_id);
      res.send(`{"status": "correct_in_a_row received is: ${req.body.correct_in_a_row}, card id received is: ${req.body.card_id}"}`);

      // ("UPDATE cards SET correct = ?, incorrect = ?, ease = ?, lapses = ?, last_review_date = ?, review_due_date = ?,  WHERE card_id = ?");

      //wrong answer
      if (answer !== card.answer.toLowerCase() && card_id != null) {
        updateReviewCard.run([
          card.correct,
          card.incorrect + 1,
          1 /*ease */,
          card.lapses + 1,
          lastReviewDateString,
          DateForDueDate.toISOString(),
          card_id,
        ] as any);
      }

      //correct answer
      else if (answer === card.answer.toLowerCase() && card_id != null) {


        if (card.ease == 1) {
          DateForDueDate.setMinutes(DateForDueDate.getUTCMinutes() + 5);
        } else if (card.ease > 1) {
          const daysToAdd = Math.round(getNextEaseLevel(card.ease));
          DateForDueDate.setDate(DateForDueDate.getUTCDate() + daysToAdd);
        }

        updateReviewCard.run([
          card.correct + 1,
          card.incorrect,
          getNextEaseLevel(card.ease),
          card.lapses,
          lastReviewDateString,
          DateForDueDate.toISOString(),
          card_id,
        ] as any)
      }


      res.send(`{"status": "success"}`);
    } else {
      res.send("missing deck name");
    }

  } catch (error) {
    console.error(error);
    res.json(error);
  }

});

// Retrieve and return all learning cards for a given deck
app.get('/api/deck/:deck_id/cards/learning', async (req, res) => {
  const deck = <Deck>selectDeckByID.get(Number(req.params.deck_id));

  const cards = <Array<Card>>selectLearningCardsByDeckID.all(deck.deck_id, "learning");

  res.json(cards);
});
app.get('/api/deck/:deck_id/cards/review', async (req, res) => {
  const deck = <Deck>selectDeckByID.get(Number(req.params.deck_id));

  const cards = <Array<Card>>selectReviewCardsByDeckID.all(deck.deck_id);

  res.json(cards);
});

app.patch('/api/deck/:deck_id/card/learning/update', async (req, res) => {
  const body = req.body;

  try {

    if (body.deck_id != null && body.question != null && body.answer != null && body.answer != null && body.card_id != null) {

      const card = <Card>selectCardByCardID.get(body.card_id);

      if ((<String>body.answer).toLowerCase() == (<String>card.answer).toLowerCase()) {
        updateLearningCard.run({
          $correct: card.correct + 1,
          $ease: ((card.ease * 1.1) + 1),

        })
      }


      res.status(200);
      res.send("success");
    }
    else {
      res.send("Missing required data");
    }

  } catch (error) {
    console.error(error);
    res.send(error);
  }
});


app.post('/api/deck/create', async (req, res) => {
  try {
    if (req.body.deckname != null) {
      insertDeck.run({ $deckname: req.body.deckname });
      res.send(`{"status": "success"}`);
    } else {
      res.send("missing deck name");
    }

  } catch (error) {
    console.error(error);
    res.json(error);
  }
});
app.delete('/api/deck/delete', async (req, res) => {
  try {
    deleteDeck.run(req.body.deck_id);
    res.send(`{"status": "success"}`);
    res.status(200);
  } catch (error) {
    console.error(error);
    res.json(error);
  }
});
app.delete('/api/card/delete', async (req, res) => {
  try {
    deleteCard.run(req.body.card_id);
    res.send(`{"status": "success"}`);
    res.status(200);
  } catch (error) {
    console.error(error);
    res.json(error);
  }
});
app.post('/api/deck/:deck_id/card/create', async (req, res) => {
  const body = req.body;

  try {

    if (body.deck_id != "" && body.question != "" && body.answer != "") {
      insertCard.run({
        $deck_id: body.deck_id,
        $question: body.question,
        $answer: body.answer,
        $card_created: body.card_created
      });
      res.json({ success: true, message: "Card created successfully" }).status(200);
    }
    else {
      res.send("Missing required data");
    }

  } catch (error) {
    console.error(error);
    res.send(error);
  }
});

app.listen(3000, () =>
  console.log('Example app listening on 127.0.0.1:3000'),
);