// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC47c3p689QVIWpkb_5hUngqBAjgmZ0dg0",
  authDomain: "blackspot-156b7.firebaseapp.com",
  projectId: "blackspot-156b7",
  storageBucket: "blackspot-156b7.firebasestorage.app",
  messagingSenderId: "529134667652",
  appId: "1:529134667652:web:576d764f0e0b952f17ffd1",
  measurementId: "G-5ZPFMNSVSR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function uid(len = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const FIXED_ROWS = 6;

function createBoard(rows = FIXED_ROWS) {
  const board = [];
  let id = 0;
  for (let row = 1; row <= rows; row++) {
    for (let col = 0; col < row; col++) {
      board.push({ id: id++, row, col, value: null, player: null });
    }
  }
  return board;
}

const indexOf = (r, c) => ((r - 1) * r) / 2 + c;

function neighboursOf(board, rows, cell) {
  if (!cell) return [];
  const { row, col } = cell;
  const coords = [
    [row, col - 1],
    [row, col + 1],
    [row - 1, col - 1],
    [row - 1, col],
    [row + 1, col],
    [row + 1, col + 1],
  ];
  return coords
    .filter(([r, c]) => r >= 1 && r <= rows && c >= 0 && c < r)
    .map(([r, c]) => board[indexOf(r, c)]);
}

export default function App() {
  const [view, setView] = useState("landing");
  const [mode, setMode] = useState(null);

  const rows = FIXED_ROWS;
  const total = useMemo(() => (rows * (rows + 1)) / 2, [rows]);

  const [board, setBoard] = useState(() => createBoard(rows));

  const [roundNumber, setRoundNumber] = useState(1);
  const [playerTurn, setPlayerTurn] = useState(1);

  const [result, setResult] = useState(null);
  const [isAIThinking, setIsAIThinking] = useState(false);

  const [roomId, setRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [joinIdInput, setJoinIdInput] = useState("");
  const [myPlayerIndex, setMyPlayerIndex] = useState(null);
  const roomUnsubRef = useRef(null);

  const lastHumanMoveRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("room");
    if (r) {
      // Auto-join the room when opening shared link
      joinRoomById(r);
    } else {
      reset();
    }
  }, []);

  function reset() {
    setBoard(createBoard(rows));
    setRoundNumber(1);
    setPlayerTurn(1);
    setResult(null);
    setIsAIThinking(false);
    lastHumanMoveRef.current = null;
  }

  function computeResultIfBlack(newBoard) {
    const filled = newBoard.filter((c) => c.value !== null).length;
    if (filled === total - 1) {
      const black = newBoard.find((c) => c.value === null);
      const neigh = neighboursOf(newBoard, rows, black);
      const sums = { 1: 0, 2: 0 };
      neigh.forEach((n) => {
        if (n && n.value !== null) sums[n.player] += n.value;
      });

      let text = "";
      if (sums[1] === sums[2]) {
        text = `It's a Tie!`;
      } else {
        const winner = sums[1] < sums[2] ? 1 : 2;
        text = `Player ${winner} Wins`;
      }

      setResult({ black, neigh, sums, text });
      return true;
    }
    return false;
  }

  function advanceTurn() {
    if (playerTurn === 1) {
      setPlayerTurn(2);
    } else {
      setPlayerTurn(1);
      setRoundNumber((r) => Math.min(r + 1, 10));
    }
  }

  function localPlaceNumber(cellIdx, isHuman = true) {
    if (result) return false;

    const cell = board[cellIdx];
    if (!cell || cell.value !== null) return false;

    const newBoard = [...board];

    newBoard[cellIdx] = {
      ...cell,
      value: roundNumber,
      player: playerTurn,
    };

    setBoard(newBoard);

    if (isHuman && mode === "single") {
      lastHumanMoveRef.current = cellIdx;
    }

    computeResultIfBlack(newBoard);
    advanceTurn();
    return true;
  }

  function aiChooseMoveAvoidingAdjacentToLastHuman() {
    const empties = board.map((c, i) => (c.value === null ? i : -1)).filter((i) => i >= 0);
    if (!empties.length) return null;

    let candidates = empties;

    const lastIdx = lastHumanMoveRef.current;
    if (typeof lastIdx === "number") {
      const forbidden = neighboursOf(board, rows, board[lastIdx]).map((c) => c?.id);
      candidates = candidates.filter((i) => !forbidden.includes(board[i].id));
    }

    if (!candidates.length) candidates = empties;

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function aiMove() {
    setIsAIThinking(true);
    setTimeout(() => {
      const pick = aiChooseMoveAvoidingAdjacentToLastHuman();
      if (pick !== null) localPlaceNumber(pick, false);
      setIsAIThinking(false);
    }, 350);
  }

  useEffect(() => {
    if (mode === "single") {
      if (playerTurn === 2 && roundNumber <= 10 && !result) {
        aiMove();
      }
    }
  }, [playerTurn, roundNumber, mode]);

  async function createRoom() {
    const id = uid(6); // 6 digit room code
    const clientId = getClientId();
    const roomRef = doc(db, "rooms", id);
    const initial = {
      id,
      rows,
      board: createBoard(rows),
      roundNumber: 1,
      playerTurn: 1,
      creatorId: clientId,
      players: { [clientId]: { index: 1, joinedAt: Date.now() } },
      started: false,
      createdAt: serverTimestamp(),
    };
    try {
      await setDoc(roomRef, initial);
      setRoomId(id);
      setMyPlayerIndex(1); // Set creator as Player 1
      setMode("multi");
      setView("multiplayer");
      subscribeRoom(id);
    } catch (e) {
      console.error("createRoom error:", e);
      alert("Failed to create room. Check console.");
    }
  }

  async function joinRoomById(id) {
    if (!id) return alert("Please enter a room ID.");
    const ref = doc(db, "rooms", id);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        alert("Room not found.");
        return;
      }
      const assignedIndex = await assignPlayerIndexToRoom(id);

      setRoomId(id);
      setMode("multi");
      setView("multiplayer");
      setMyPlayerIndex(assignedIndex);

      subscribeRoom(id);
    } catch (e) {
      console.error("joinRoom error:", e);
      alert("Failed to join room. Check console.");
    }
  }

  async function assignPlayerIndexToRoom(roomIdToUse) {
    const clientId = getClientId();
    const roomRef = doc(db, "rooms", roomIdToUse);
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) return null;
      const data = snap.data();
      const players = data.players || {};
      if (players[clientId]) {
        return players[clientId].index;
      }
      const indexes = Object.values(players).map((p) => p.index);
      if (!indexes.includes(1)) {
        players[clientId] = { index: 1, joinedAt: Date.now() };
      } else if (!indexes.includes(2)) {
        players[clientId] = { index: 2, joinedAt: Date.now() };
      } else {
        players[clientId] = { index: null, joinedAt: Date.now() };
      }
      await updateDoc(roomRef, { players });
      return players[clientId].index;
    } catch (e) {
      console.error("assignPlayerIndex error:", e);
      return null;
    }
  }

  function getClientId() {
    let id = sessionStorage.getItem("blackspot_clientid");
    if (!id) {
      id = uid(12);
      sessionStorage.setItem("blackspot_clientid", id);
    }
    return id;
  }

  function subscribeRoom(id) {
    const ref = doc(db, "rooms", id);
    if (roomUnsubRef.current) {
      try {
        roomUnsubRef.current();
      } catch (e) {}
      roomUnsubRef.current = null;
    }

    roomUnsubRef.current = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setRoomData(data);
        setBoard(data.board || createBoard(rows));
        setRoundNumber(data.roundNumber || 1);
        setPlayerTurn(data.playerTurn || 1);

        // Set myPlayerIndex based on current client
        const clientId = getClientId();
        const players = data.players || {};
        if (players[clientId]) {
          setMyPlayerIndex(players[clientId].index);
        }

        if (data.started) {
          setView("game");
        } else {
          setView("multiplayer");
        }

        computeResultIfBlack(data.board || createBoard(rows));
      },
      (err) => {
        console.error("onSnapshot error:", err);
      }
    );
  }

  async function startGame() {
    if (!roomId) return;
    const clientId = getClientId();
    if (!roomData) {
      alert("Room data not loaded yet.");
      return;
    }
    if (roomData.creatorId !== clientId) {
      alert("Only the room creator can start the game.");
      return;
    }

    try {
      await updateDoc(doc(db, "rooms", roomId), {
        started: true,
        roundNumber: 1,
        playerTurn: 1,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("startGame error:", e);
      alert("Failed to start game. Check console.");
    }
  }

  async function placeNumberInRoom(cellIdx) {
    if (!roomId) return;
    if (result) return;

    if (myPlayerIndex !== playerTurn) {
      alert("Not your turn!");
      return;
    }

    const cell = board[cellIdx];
    if (!cell || cell.value !== null) return;

    const newBoard = [...board];
    newBoard[cellIdx] = {
      ...cell,
      value: roundNumber,
      player: playerTurn,
    };

    const nextP = playerTurn === 1 ? 2 : 1;
    const nextR = playerTurn === 2 ? Math.min(roundNumber + 1, 10) : roundNumber;

    try {
      await updateDoc(doc(db, "rooms", roomId), {
        board: newBoard,
        roundNumber: nextR,
        playerTurn: nextP,
        updatedAt: serverTimestamp(),
      });

      setBoard(newBoard);
      setRoundNumber(nextR);
      setPlayerTurn(nextP);

      computeResultIfBlack(newBoard);
    } catch (e) {
      console.error("placeNumberInRoom error:", e);
      alert("Failed to save move to room. Check console.");
    }
  }

  useEffect(() => {
    return () => {
      if (roomUnsubRef.current) roomUnsubRef.current();
    };
  }, []);

  function Landing() {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-slate-100">
        <div className="text-center max-w-xl">
          <h1 className="text-5xl font-extrabold mb-2">BLACKSPOT</h1>
          <div className="text-lg text-slate-300 mb-3">
            Welcome – place your numbers wisely. The triangle remembers.
          </div>
          <div className="italic text-sm text-slate-400 mb-6">
            "One lonely circle can wreck your day."
          </div>

          <div className="flex gap-4 justify-center mb-6">
            <button
              className="px-6 py-3 rounded-full bg-teal-600 text-white shadow-md transition-all duration-200 hover:scale-105 hover:border hover:border-white"
              onClick={() => {
                setMode("single");
                reset();
                setView("game");
              }}
            >
              Single Player
            </button>

            <button
              className="px-6 py-3 rounded-full bg-teal-600 text-white shadow-md transition-all duration-200 hover:scale-105 hover:border hover:border-white"
              onClick={() => {
                setMode("multi");
                reset();
                setView("multiplayer");
              }}
            >
              Multiplayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  function MultiplayerPanel() {
    const shareLink = roomId
      ? `${window.location.origin}${window.location.pathname}?room=${roomId}`
      : "";

    const clientId = getClientId();
    const isCreator = roomData?.creatorId === clientId;
    const players = roomData?.players || {};
    const playerCount = Object.values(players).filter(p => p.index === 1 || p.index === 2).length;
    const hasOpponent = playerCount >= 2;

    return (
      <div className="min-h-screen p-6 bg-slate-900 text-slate-100">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Multiplayer Lobby</h2>
            <button
              className="px-3 py-1 rounded-full bg-slate-800 text-white shadow-md hover:border hover:border-white"
              onClick={() => setView("landing")}
            >
              Home
            </button>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg shadow">
            {!roomId ? (
              <div className="flex gap-3 mb-3">
                <button
                  className="px-4 py-2 rounded-full bg-teal-600 text-white hover:border hover:border-white"
                  onClick={createRoom}
                >
                  Create Room
                </button>

                <input
                  placeholder="Enter room id"
                  value={joinIdInput}
                  onChange={(e) => setJoinIdInput(e.target.value)}
                  className="p-1 bg-slate-700 text-slate-100 rounded-full px-3"
                />
                <button
                  className="px-3 py-1 rounded-full bg-teal-600 text-white hover:border hover:border-white"
                  onClick={() => joinRoomById(joinIdInput)}
                >
                  Join Room
                </button>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-slate-700 rounded-lg">
                <div className="mb-3">
                  <strong className="text-lg">Room Code:</strong>
                  <div className="text-3xl font-bold text-teal-400 my-2">{roomId}</div>
                </div>
                <div className="mb-3">
                  <strong>Share Link:</strong>{" "}
                  <a className="text-indigo-300 break-all" href={shareLink}>
                    {shareLink}
                  </a>
                </div>

                <div className="mb-4 p-3 bg-slate-600 rounded">
                  <div className="font-bold mb-2">Players:</div>
                  <div className="text-sm">
                    Player 1: {Object.entries(players).find(([_, p]) => p.index === 1)?.[0] === clientId ? "You" : "Opponent"} {Object.entries(players).find(([_, p]) => p.index === 1) ? "✓" : "Waiting..."}
                  </div>
                  <div className="text-sm">
                    Player 2: {Object.entries(players).find(([_, p]) => p.index === 2)?.[0] === clientId ? "You" : "Opponent"} {Object.entries(players).find(([_, p]) => p.index === 2) ? "✓" : "Waiting..."}
                  </div>
                </div>

                {!hasOpponent && (
                  <div className="text-center py-4 text-yellow-400 font-semibold animate-pulse">
                    Waiting for opponent...
                  </div>
                )}

                {isCreator && (
                  <button
                    className={`w-full px-4 py-3 rounded-full text-white font-bold ${
                      hasOpponent
                        ? "bg-green-600 hover:bg-green-700 hover:border hover:border-white"
                        : "bg-gray-600 cursor-not-allowed opacity-50"
                    }`}
                    onClick={startGame}
                    disabled={!hasOpponent}
                  >
                    {hasOpponent ? "Start Game" : "Waiting for Player 2..."}
                  </button>
                )}

                {!isCreator && (
                  <div className="text-center py-3 text-slate-300">
                    Waiting for host to start the game...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function GameView() {
    return (
      <div className="min-h-screen p-6 bg-slate-900 text-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">BLACKSPOT</h1>
              <div className="text-sm text-slate-300">
                Mode:{" "}
                {mode === "single"
                  ? "Single Player (You vs AI)"
                  : "Multiplayer (live)"}{" "}
                – Round {roundNumber} – Player {playerTurn}
                {mode === "single" && playerTurn === 2 && (
                  <span className="ml-2 text-xs">(AI thinking...)</span>
                )}
                {mode === "multi" && (
                  <span className="ml-2 text-xs text-slate-400">
                    Your slot: {myPlayerIndex || "Spectator"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="px-3 py-1 bg-slate-700 rounded-full text-white hover:border hover:border-white"
                onClick={() => {
                  reset();
                  if (mode === "multi" && roomId) {
                    updateDoc(doc(db, "rooms", roomId), {
                      board: createBoard(rows),
                      roundNumber: 1,
                      playerTurn: 1,
                    });
                  }
                }}
              >
                Reset
              </button>

              <button
                className="px-3 py-1 bg-slate-700 rounded-full text-white hover:border hover:border-white"
                onClick={() => {
                  if (roomUnsubRef.current) roomUnsubRef.current();
                  setRoomId(null);
                  setMyPlayerIndex(null);
                  setMode(null);
                  setView("landing");
                }}
              >
                Home
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <div>
              {Array.from({ length: rows }).map((_, r) => {
                const rowIndex = r + 1;
                const start = ((rowIndex - 1) * rowIndex) / 2;
                const rowCells = board.slice(start, start + rowIndex);

                return (
                  <div key={r} className="flex justify-center gap-3 mb-3">
                    {rowCells.map((cell, ci) => {
                      const idx = indexOf(rowIndex, ci);
                      const isBlack =
                        result?.black?.id === cell.id;
                      const isNeighbour =
                        result?.neigh?.some((n) => n.id === cell.id);

                      return (
                        <button
                          key={cell.id}
                          onClick={() => {
                            if (mode === "single") {
                              if (playerTurn === 2) return;
                              localPlaceNumber(idx, true);
                            } else {
                              placeNumberInRoom(idx);
                            }
                          }}
                          className={`w-14 h-14 rounded-full shadow flex items-center justify-center
                            ${
                              cell.value === null
                                ? "bg-slate-800"
                                : "bg-gradient-to-br from-slate-700 to-slate-600"
                            }
                            ${cell.player === 1 ? "ring-2 ring-indigo-400" : ""}
                            ${cell.player === 2 ? "ring-2 ring-pink-400" : ""}
                            ${isBlack ? "bg-black text-white" : ""}
                            ${isNeighbour ? "scale-105 shadow-lg" : ""}
                          `}
                        >
                          {cell.value}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <div className="mt-4">
              {result ? (
                <div className="p-4 rounded-md bg-slate-800 shadow text-center">
                  <div className="text-xl font-bold text-white mb-1">
                    Player 1: {result.sums[1]}
                  </div>
                  <div className="text-xl font-bold text-white mb-3">
                    Player 2: {result.sums[2]}
                  </div>
                  <div className="text-3xl font-extrabold text-indigo-300">
                    Player {result.sums[1] < result.sums[2] ? 1 : (result.sums[1] > result.sums[2] ? 2 : "")} 
                    {result.sums[1] === result.sums[2] ? "It's a Tie!" : " Wins yeyyyy!!"}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">
                  Place numbers until one empty cell (the black spot) remains.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {view === "landing" && <Landing />}
      {view === "multiplayer" && <MultiplayerPanel />}
      {view === "game" && <GameView />}
    </>
  );
}