import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const GameSessionContext = createContext(null);
const STORAGE_KEY = "go-game-session-id";
const PLAYER_STORAGE_KEY = "go-player-profile";
const VALID_STONES = new Set(["empty", "black", "white"]);

function canHumanMove(gameState, playerProfile) {
  if (gameState?.status !== "active") return false;
  if (gameState.opponentType !== "HUMAN") return gameState.toMove === gameState.humanColor;
  if (!playerProfile || !gameState.whitePlayerId) return false;

  const playerColor = gameState.blackPlayerId === playerProfile.id
    ? "black"
    : gameState.whitePlayerId === playerProfile.id
      ? "white"
      : null;
  return playerColor === gameState.toMove;
}

function isGameSnapshot(snapshot) {
  return Boolean(
    snapshot
      && typeof snapshot.id === "string"
      && (snapshot.size === 9 || snapshot.size === 19)
      && Array.isArray(snapshot.board)
      && snapshot.board.length === snapshot.size
      && snapshot.board.every((row) => (
        Array.isArray(row)
          && row.length === snapshot.size
          && row.every((stone) => VALID_STONES.has(stone))
      ))
      && ["black", "white"].includes(snapshot.toMove)
      && ["active", "finished"].includes(snapshot.status)
      && Number.isInteger(snapshot.captures?.black)
      && Number.isInteger(snapshot.captures?.white),
  );
}

async function requestGameSnapshot(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  let snapshot;
  try {
    snapshot = await response.json();
  } catch {
    throw new Error("Máy chủ trả về phản hồi không hợp lệ.");
  }

  if (!response.ok) {
    const error = new Error(snapshot?.error || "Không thể thực hiện thao tác.");
    error.status = response.status;
    throw error;
  }
  if (!isGameSnapshot(snapshot)) {
    throw new Error("Máy chủ trả về trạng thái ván cờ không hợp lệ.");
  }

  return snapshot;
}

async function requestJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...options.headers },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Máy chủ trả về phản hồi không hợp lệ.");
  }
  if (!response.ok) {
    const error = new Error(data?.error || "Không thể thực hiện thao tác.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function readStoredPlayer() {
  try {
    const profile = JSON.parse(window.localStorage.getItem(PLAYER_STORAGE_KEY));
    return profile && typeof profile.id === "string" && typeof profile.username === "string"
      ? profile
      : null;
  } catch {
    return null;
  }
}

function storePlayer(profile) {
  try {
    window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

function readStoredGameID() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeGameID(gameID) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, gameID);
    return true;
  } catch {
    return false;
  }
}

function removeStoredGameID() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Keep the in-memory session usable if this browser blocks storage.
  }
}

export function GameSessionProvider({ children }) {
  const [gameState, setGameState] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(readStoredPlayer);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isRequestPending, setIsRequestPending] = useState(false);
  const [isComputerThinking, setIsComputerThinking] = useState(false);
  const [notice, setNotice] = useState(null);
  const [canRetryRestore, setCanRetryRestore] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const requestInFlight = useRef(false);

  useEffect(() => {
    if (!playerProfile) return undefined;
    const controller = new AbortController();
    requestJSON(`/api/users/${encodeURIComponent(playerProfile.id)}`, { signal: controller.signal })
      .then((profile) => {
        if (typeof profile.id !== "string" || typeof profile.username !== "string") {
          throw new Error("Hồ sơ người chơi không hợp lệ.");
        }
        setPlayerProfile(profile);
        storePlayer(profile);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error.status === 404) {
          setPlayerProfile(null);
          try { window.localStorage.removeItem(PLAYER_STORAGE_KEY); } catch { /* Keep the app usable. */ }
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const storedGameID = readStoredGameID();
    setIsRestoring(true);
    setCanRetryRestore(false);

    if (!storedGameID) {
      setIsRestoring(false);
      return () => controller.abort();
    }

    requestGameSnapshot(`/api/games/${encodeURIComponent(storedGameID)}`, {
      signal: controller.signal,
    })
      .then((restoredGame) => {
        setGameState(restoredGame);
        setNotice(null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        if (error.status === 404) {
          removeStoredGameID();
          setNotice({
            type: "status",
            message: "Ván trước không còn trên máy chủ. Bạn có thể bắt đầu ván mới.",
          });
          return;
        }

        setCanRetryRestore(true);
        setNotice({
          type: "error",
          message: `Chưa khôi phục được ván trước. ${error.message}`,
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRestoring(false);
      });

    return () => controller.abort();
  }, [restoreAttempt]);

  const registerPlayer = useCallback(async (credentials) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setIsRequestPending(true);
    setNotice(null);
    try {
      const profile = await requestJSON("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      setPlayerProfile(profile);
      if (!storePlayer(profile)) {
        setNotice({ type: "status", message: "Đã tạo hồ sơ, nhưng trình duyệt không lưu được hồ sơ này." });
      }
      return profile;
    } catch (error) {
      setNotice({ type: "error", message: error.message });
      return null;
    } finally {
      requestInFlight.current = false;
      setIsRequestPending(false);
    }
  }, []);

  const startGame = useCallback(async (settings) => {
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    setIsRequestPending(true);
    setNotice(null);

    try {
      const payload = { ...settings };
      if (playerProfile && settings.opponentType === "HUMAN") payload.creatorId = playerProfile.id;
      const nextGame = await requestGameSnapshot("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setGameState(nextGame);
      setCanRetryRestore(false);

      if (!storeGameID(nextGame.id)) {
        setNotice({
          type: "status",
          message: "Ván đang chạy. Trình duyệt không lưu được mã để khôi phục sau khi tải lại.",
        });
      }
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      requestInFlight.current = false;
      setIsRequestPending(false);
    }
  }, [playerProfile]);

  const joinGame = useCallback(async ({ inviteCode, password }) => {
    if (requestInFlight.current || !playerProfile) return;
    requestInFlight.current = true;
    setIsRequestPending(true);
    setNotice(null);
    try {
      const nextGame = await requestGameSnapshot("/api/games/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode, password, playerId: playerProfile.id }),
      });
      setGameState(nextGame);
      if (!storeGameID(nextGame.id)) {
        setNotice({ type: "status", message: "Đã vào phòng. Trình duyệt không lưu được mã phòng để khôi phục sau khi tải lại." });
      }
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      requestInFlight.current = false;
      setIsRequestPending(false);
    }
  }, [playerProfile]);

  const submitAction = useCallback(async (action) => {
    if (!gameState || requestInFlight.current || !canHumanMove(gameState, playerProfile)) return;

    const currentGame = gameState;
    requestInFlight.current = true;
    setIsRequestPending(true);
    setIsComputerThinking(action.type !== "resign");
    setNotice(null);

    try {
      const playerQuery = currentGame.opponentType === "HUMAN" && playerProfile
        ? `?playerId=${encodeURIComponent(playerProfile.id)}`
        : "";
      const nextGame = await requestGameSnapshot(`/api/games/${currentGame.id}/actions${playerQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      setGameState(nextGame);
    } catch (actionError) {
      try {
        const latestGame = await requestGameSnapshot(`/api/games/${currentGame.id}`);
        setGameState(latestGame);
        setNotice({
          type: "error",
          message: JSON.stringify(latestGame) === JSON.stringify(currentGame)
            ? actionError.message
            : "Kết nối bị gián đoạn. Bàn cờ đã được đồng bộ lại với máy chủ.",
        });
      } catch {
        setNotice({
          type: "error",
          message: `${actionError.message} Chưa thể đồng bộ lại trạng thái ván cờ. Hãy thử lại sau.`,
        });
      }
    } finally {
      requestInFlight.current = false;
      setIsRequestPending(false);
      setIsComputerThinking(false);
    }
  }, [gameState, playerProfile]);

  useEffect(() => {
    if (!gameState || gameState.status !== "active" || gameState.opponentType !== "HUMAN") return undefined;
    const timer = window.setInterval(async () => {
      if (requestInFlight.current) return;
      try {
        const latestGame = await requestGameSnapshot(`/api/games/${encodeURIComponent(gameState.id)}`);
        if (!requestInFlight.current) setGameState(latestGame);
      } catch {
        // Keep the current board visible during a temporary polling failure.
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [gameState?.id, gameState?.status, gameState?.opponentType]);

  const startNewGame = useCallback(() => {
    if (gameState?.status !== "finished") return;

    removeStoredGameID();
    setGameState(null);
    setCanRetryRestore(false);
    setNotice(null);
  }, [gameState]);

  const retryRestore = useCallback(() => {
    if (!canRetryRestore || requestInFlight.current) return;

    setNotice(null);
    setRestoreAttempt((attempt) => attempt + 1);
  }, [canRetryRestore]);

  const session = useMemo(() => ({
    gameState,
    playerProfile,
    isRestoring,
    isRequestPending,
    isComputerThinking,
    isHumanTurn: canHumanMove(gameState, playerProfile),
    notice,
    canRetryRestore,
    startGame,
    joinGame,
    registerPlayer,
    submitAction,
    startNewGame,
    retryRestore,
  }), [
    gameState,
    playerProfile,
    isRestoring,
    isRequestPending,
    isComputerThinking,
    notice,
    canRetryRestore,
    startGame,
    joinGame,
    registerPlayer,
    submitAction,
    startNewGame,
    retryRestore,
  ]);

  return (
    <GameSessionContext.Provider value={session}>
      {children}
    </GameSessionContext.Provider>
  );
}

export function useGameSession() {
  const session = useContext(GameSessionContext);
  if (!session) {
    throw new Error("useGameSession must be used inside GameSessionProvider.");
  }
  return session;
}
