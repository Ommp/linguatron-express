import express, { Express, Request, Response } from "express";
// import path from "path";

import bodyParser from "body-parser";

import { Database } from "bun:sqlite";

const app: Express = express();

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
  question: string
}


const db = new Database("mydb.sqlite");
db.exec("PRAGMA journal_mode = WAL;");

function createCardsTable() {
  return db.query("CREATE TABLE IF NOT EXISTS cards (card_id INTEGER PRIMARY KEY, deck_id INTEGER, question TEXT, answer TEXT, FOREIGN KEY (deck_id) REFERENCES decks(deck_id) ON DELETE CASCADE)");
}

function createDecksTable() {
  return db.query("CREATE TABLE IF NOT EXISTS decks (deck_id INTEGER PRIMARY KEY, deckname TEXT)");
}

const selectAllDecks = db.query("select * from decks");

const selectDeckByID = db.prepare("SELECT deck_id, deckname from decks WHERE deck_id = ?");
const selectAllCardsByDeckID = db.prepare("SELECT * from cards WHERE deck_id = ?");


createCardsTable().run();
createDecksTable().run();


const insertCard = db.prepare("INSERT INTO cards (deck_id, question, answer) VALUES ($deck_id, $question, $answer)");
const insertDeck = db.prepare("INSERT INTO decks (deckname) VALUES ($deckname)");
const deleteDeck = db.query("DELETE FROM decks WHERE deck_id = ?");


//API
app.get('/api/decks', (req, res) => {
  let decks = <Array<Deck>>selectAllDecks.all();
  res.json({ decks: decks });
});
app.get('/api/deck/:deck_id', async (req, res) => {
  const deck = selectDeckByID.get(Number(req.params.deck_id));
  res.json({ deck: deck });
});
app.get('/api/deck/:deck_id/cards', async (req, res) => {
  const deck = <Deck>selectDeckByID.get(Number(req.params.deck_id));

  const cards = <Array<Card>>selectAllCardsByDeckID.all(deck.deck_id);

  res.json({ cards: cards });
});
app.post('/api/deck/create', async (req, res) => {
  try {
    insertDeck.run({ $deckname: req.body.deckname });
    res.send(`{"status": "success"}`);
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
app.post('/api/deck/:deck_id/card/create', async (req, res) => {
  const body = req.body;

  try {
    insertCard.run({
      $deck_id: body.deck_id,
      $question: body.question,
      $answer: body.answer
    });
    res.status(200);
  } catch (error) {
    console.error(error);
    res.send(error);
  }
});

app.listen(3000, () =>
  console.log('Example app listening on 127.0.0.1:3000'),
);