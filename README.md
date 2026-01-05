# BlackSpot 🖤

BlackSpot is a simple number-placing strategy game built with **React**.  
You can play it **alone against AI** or **online with a friend** using a room code.

The goal is to place numbers smartly and avoid losing at the final “black spot”.

live:[https://blackspot-156b7.web.app/](https://blackspot-156b7.web.app/)

---

## What is this game?

- The board is shaped like a **triangle**
- Players take turns placing numbers
- When only **one empty cell** remains (the black spot), the game ends
- The numbers around the black spot are added
- The player with the **smaller total wins**

---

## Game Modes

### 🎮 Single Player
- Play against a simple AI
- AI automatically makes its move

### 🌐 Multiplayer
- Create a room
- Share the room code or link
- Play live using **Firebase Firestore**

---

## Built With

- React
- JavaScript
- Firebase (Firestore)
- Tailwind CSS
- Vite

---

## How to Run Locally

1. Clone the repository
git clone
- https://github.com/Divyasree00/blackspot.git

3. Go to the project folder
-cd blackspot

4. Install dependencies
-npm install

5. Start the app
-npm run dev

## How Multiplayer Works

- Firebase stores game state in real time

- One player creates a room

- Another player joins using the room code

- Only the room creator can start the game


## License

This project is open-source and free to use.

### Enjoy playing BlackSpot 🖤
Think before you place — the triangle remembers.
