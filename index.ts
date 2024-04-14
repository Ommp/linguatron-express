import express, { Express, Request, Response } from "express";
// import path from "path";

import bodyParser from "body-parser";

import { Database } from "bun:sqlite";

import { compile } from "ejs";

const app: Express = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static('public'));
// app.use(express.static(path.join(__dirname, 'public')))
app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));

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
const selectAllCardsByDeckID = db.prepare("SELECT card_id, question, answer from cards WHERE deck_id = ?");

createCardsTable().run();
createDecksTable().run();


const insertCard = db.prepare("INSERT INTO cards (deck_id, question, answer) VALUES ($deck_id, $question, $answer)");
const insertDeck = db.prepare("INSERT INTO decks (deckname) VALUES ($deckname)");

//insert test deck
// insertDeck.run({
//   $deckname: "Spanish"
// });

//insert test card
//  insertCard.run({
//   $deck_id: 1,
//   $question: "la palabra",
//   $answer: "word",
// });

app.get('/', (req, res) => {
  res.render('index', { foo: "FOO", title: "Home"});
});
app.post('/clicked', (req, res) => {
  res.send(selectAllDecks.all());
});

app.get('/decks', (req, res) => {
  let decks = <Array<Deck>>selectAllDecks.all();
  res.render('decks', { decks: decks, title: "Decks" });
});

// app.get('/deck/:deck_id', (req, res) => {
//   const deck = < Deck > selectDeckByID.get(Number(req.params.deck_id));
//   res.render('deck', {deck: deck});
// });

app.get('/deck/:deck_id', (req, res) => {
    const deck = selectDeckByID.get(Number(req.params.deck_id));
    res.send(`<div class="container fixed-grid has-1-cols">
    <div id=deck> 
    <h1 class="title">Deck: ${deck.deckname} </h1>
    <div class="buttons">
    <button class="button learn lr" hx-target=".buttons" hx-trigger="click" hx-swap="outerHTML" hx-post="/deck/${Number(req.params.deck_id)}/learn"> Learn </button>
    <button class="button review lr" hx-target=".buttons" hx-trigger="click" hx-swap="outerHTML" hx-post="/deck/${Number(req.params.deck_id)}/learn"> Review </button>
    </div>
    </div>
  </div>`);
  
});
app.post('/deck/:deck_id/learn', (req, res) => {
  const cards = selectAllCardsByDeckID.all(Number(req.params.deck_id));
  res.send(`htmx`);
});

app.listen(3000, () =>
  console.log('Example app listening on 127.0.0.1:3000'),
);