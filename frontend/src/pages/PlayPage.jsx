import { useState } from "react";
import BoardPreview from "../components/BoardPreview.jsx";
import GoBoard from "../components/GoBoard.jsx";
import { useGameSession } from "../context/GameSessionContext.jsx";

const DIFFICULTY_OPTIONS = [
  {
    id: "beginner",
    title: "Tập sự",
    rank: "20–15 Kyu",
    visits: 5,
    description: "Nhẹ nhàng, làm quen luật và thế cờ",
  },
  {
    id: "easy",
    title: "Dễ",
    rank: "12–10 Kyu",
    visits: 20,
    description: "Biết giữ góc và nối quân cơ bản",
  },
  {
    id: "medium",
    title: "Trung bình",
    rank: "7–5 Kyu",
    visits: 80,
    description: "Thế cờ cân bằng, giữ hình chắc chắn (Khuyên dùng)",
  },
  {
    id: "hard",
    title: "Khó",
    rank: "3–1 Kyu",
    visits: 250,
    description: "Đọc cờ sâu, đòn góc và bao vây nhạy bén",
  },
  {
    id: "master",
    title: "Cao thủ",
    rank: "Đẳng cấp Dan",
    visits: 800,
    description: "Sức mạnh tính toán sâu nhất của KataGo",
  },
  {
    id: "custom",
    title: "Tùy chỉnh",
    rank: "Tự chọn",
    visits: null,
    description: "Tự cấu hình số lượt tính toán MCTS (1–2000)",
  },
];

function formatScore(score) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1).replace(".", ",");
}

function getDifficultyLabel(difficulty, visits) {
  switch (difficulty) {
    case "beginner":
      return "Tập sự (20–15K)";
    case "easy":
      return "Dễ (12–10K)";
    case "medium":
      return "Trung bình (7–5K)";
    case "hard":
      return "Khó (3–1K)";
    case "master":
      return "Cao thủ (Dan)";
    case "custom":
      return `Tùy chỉnh (${visits ?? "?"}v)`;
    default:
      return "Tiêu chuẩn";
  }
}

function Notice({ notice }) {
  if (!notice) return null;

  return (
    <p
      className={`notice notice--${notice.type}`}
      role={notice.type === "error" ? "alert" : "status"}
      aria-live={notice.type === "error" ? "assertive" : "polite"}
    >
      {notice.message}
    </p>
  );
}

function SetupPage({
  playerProfile,
  registerPlayer,
  isRequestPending,
  notice,
  canRetryRestore,
  startGame,
  joinGame,
  retryRestore,
}) {
  const [boardSize, setBoardSize] = useState(9);
  const [difficulty, setDifficulty] = useState("medium");
  const [customVisits, setCustomVisits] = useState(100);
  const [opponentType, setOpponentType] = useState("BOT");
  const [gameMode, setGameMode] = useState("PUBLIC");
  const [gameName, setGameName] = useState("");
  const [gamePassword, setGamePassword] = useState("");
  const [username, setUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");

  const needsProfile = opponentType === "HUMAN";
  const canStart = !isRequestPending
    && (!needsProfile || playerProfile)
    && (!needsProfile || gameMode !== "PRIVATE" || gamePassword.trim().length > 0);

  const handleStart = () => {
    if (!canStart) return;
    const settings = {
      boardSize,
      difficulty: opponentType === "BOT" ? difficulty : "medium",
      opponentType,
      gameMode: needsProfile ? gameMode : "PUBLIC",
    };
    if (difficulty === "custom" && opponentType === "BOT") settings.customVisits = Number(customVisits);
    if (gameName.trim()) settings.name = gameName.trim();
    if (gameMode === "PRIVATE") settings.password = gamePassword;
    startGame(settings);
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const profile = await registerPlayer({ username: username.trim(), password: accountPassword });
    if (profile) setAccountPassword("");
  };

  const handleJoin = (event) => {
    event.preventDefault();
    joinGame({ inviteCode: inviteCode.trim(), password: joinPassword });
  };

  return (
    <main className="setup-page" id="main-content" data-enter>
      <section className="setup-stage" aria-labelledby="setup-heading">
        <div className="setup-stage-inner wrap">
          <div className="setup-copy">
            <p className="eyebrow">Cờ vây · Bàn 9×9 và 19×19</p>
            <h1 id="setup-heading">Chọn đối thủ. Bắt đầu một ván cờ.</h1>
            <p className="page-intro">
              Chơi cùng KataGo hoặc mời bạn bè vào phòng riêng. Có bàn 9×9 cho ván nhanh và bàn 19×19 cho ván tiêu chuẩn.
            </p>

        <div className="setup-options" aria-busy={isRequestPending}>
          <h2 className="setup-section-title">Đối thủ trong ván</h2>
          <div className="board-selection-grid" role="radiogroup" aria-label="Loại đối thủ">
            {[{ id: "BOT", title: "KataGo", description: "Chơi một mình, có thể chọn độ khó" }, { id: "HUMAN", title: "Người chơi", description: "Tạo phòng và mời đối thủ bằng mã" }].map((option) => (
              <button
                key={option.id}
                type="button"
                className={`selection-card ${opponentType === option.id ? "selection-card--active" : ""}`}
                disabled={isRequestPending}
                onClick={() => setOpponentType(option.id)}
                role="radio"
                aria-checked={opponentType === option.id}
              >
                <strong>{option.title}</strong>
                <span className="choice-description">{option.description}</span>
              </button>
            ))}
          </div>

          {(needsProfile || showProfileForm) && !playerProfile && (
            <details className="profile-form setup-block" open={needsProfile || showProfileForm}>
              <summary>Tạo hồ sơ chơi</summary>
              <form onSubmit={handleRegister}>
              <p className="form-hint">Hồ sơ giúp máy chủ nhận diện lượt đi của bạn trong phòng. Hồ sơ được lưu trên thiết bị này.</p>
              <label htmlFor="player-username">Tên người chơi</label>
              <input id="player-username" autoComplete="username" minLength="3" maxLength="32" pattern="[a-zA-Z0-9_-]+" required value={username} onChange={(event) => setUsername(event.target.value)} />
              <label htmlFor="player-password">Mật khẩu hồ sơ</label>
              <input id="player-password" type="password" autoComplete="new-password" minLength="6" maxLength="128" required value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} />
                <button className="button button--secondary" type="submit" disabled={isRequestPending}>Tạo hồ sơ</button>
              </form>
            </details>
          )}

          {playerProfile && needsProfile && (
            <p className="profile-active" role="status">Đang chơi với hồ sơ <strong>{playerProfile.username}</strong>.</p>
          )}

          {needsProfile && (
            <div className="setup-block">
              <h2 className="setup-section-title">Phòng đấu</h2>
              <label className="field-label" htmlFor="game-name">Tên phòng <span>(không bắt buộc)</span></label>
              <input id="game-name" maxLength="64" value={gameName} onChange={(event) => setGameName(event.target.value)} placeholder="Ví dụ: Ván tối nay" disabled={isRequestPending} />
              <div className="inline-fields">
                <label><input type="radio" name="game-mode" checked={gameMode === "PUBLIC"} onChange={() => setGameMode("PUBLIC")} disabled={isRequestPending} /> Phòng công khai</label>
                <label><input type="radio" name="game-mode" checked={gameMode === "PRIVATE"} onChange={() => setGameMode("PRIVATE")} disabled={isRequestPending} /> Phòng riêng</label>
              </div>
              {gameMode === "PRIVATE" && (
                <>
                  <label className="field-label" htmlFor="game-password">Mật khẩu phòng</label>
                  <input id="game-password" type="password" maxLength="128" value={gamePassword} onChange={(event) => setGamePassword(event.target.value)} autoComplete="new-password" disabled={isRequestPending} />
                </>
              )}
            </div>
          )}

          <h2 className="setup-section-title">Kích thước bàn</h2>
          <div className="board-selection-grid" role="radiogroup" aria-label="Kích thước bàn cờ">
            {[9, 19].map((size) => (
              <button
                key={size}
                type="button"
                className={`selection-card ${boardSize === size ? "selection-card--active" : ""}`}
                disabled={isRequestPending}
                onClick={() => setBoardSize(size)}
                role="radio"
                aria-checked={boardSize === size}
              >
                <span className="choice-size">{size}×{size}</span>
                <span className="choice-description">
                  {size === 9 ? "Bàn nhỏ · Ván ngắn luyện nhanh" : "Bàn tiêu chuẩn · Thế cờ rộng"}
                </span>
              </button>
            ))}
          </div>

          {opponentType === "BOT" && <div className="difficulty-control">
          <label className="setup-section-title" htmlFor="difficulty-select">Độ khó KataGo</label>
          <select
            id="difficulty-select"
            className="difficulty-select"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
            disabled={isRequestPending}
          >
            {DIFFICULTY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}{option.visits ? ` · ${option.visits} lượt tính toán/nước` : ""}
              </option>
            ))}
          </select>
          <p className="difficulty-hint">Số lượt tính toán của KataGo cho mỗi nước đi.</p>

          {difficulty === "custom" && (
            <div className="custom-visits-box">
              <label htmlFor="custom-visits-input">
                Số lượt tính toán (MCTS visits, từ 1 đến 2000):
              </label>
              <input
                id="custom-visits-input"
                type="number"
                min="1"
                max="2000"
                value={customVisits}
                onChange={(e) => setCustomVisits(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))}
                className="custom-visits-input"
                disabled={isRequestPending}
              />
            </div>
          )}
          </div>}

          <button
            type="button"
            className="button button--primary start-game-button"
            disabled={!canStart}
            onClick={handleStart}
          >
            {isRequestPending
              ? "Đang khởi tạo ván…"
              : needsProfile && !playerProfile
                ? "Tạo hồ sơ để mở phòng"
              : `Bắt đầu ván ${boardSize}×${boardSize}`}
          </button>

          {canRetryRestore && (
            <button className="text-link restore-link" type="button" onClick={retryRestore}>
              Thử khôi phục ván trước
            </button>
          )}
          <Notice notice={notice} />

          <details className="join-room setup-block">
            <summary id="join-room-heading">Mã phòng</summary>
            {!playerProfile ? (
              <>
              <p className="form-hint">Tạo hồ sơ người chơi trước để vào phòng nhiều người.</p>
              <button className="text-link" type="button" onClick={() => setShowProfileForm(true)}>Tạo hồ sơ người chơi</button>
              </>
            ) : (
              <form onSubmit={handleJoin}>
                <label className="field-label" htmlFor="invite-code">Mã mời gồm 6 chữ số</label>
                <input id="invite-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required value={inviteCode} onChange={(event) => setInviteCode(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={isRequestPending} />
                <label className="field-label" htmlFor="join-password">Mật khẩu phòng <span>(nếu có)</span></label>
                <input id="join-password" type="password" autoComplete="off" value={joinPassword} onChange={(event) => setJoinPassword(event.target.value)} disabled={isRequestPending} />
                <button className="button button--secondary" type="submit" disabled={isRequestPending || inviteCode.length !== 6}>Vào phòng</button>
              </form>
            )}
          </details>
          </div>
          </div>
          <aside className="setup-art" aria-label="Hình minh họa bàn cờ vây">
            <div className="preview-label">
              <span className="preview-ring" aria-hidden="true" />
              <span>Bàn cờ · {boardSize}×{boardSize} · {opponentType === "BOT" ? "KataGo" : "Đối kháng"}</span>
            </div>
            <BoardPreview />
          </aside>
        </div>
      </section>
    </main>
  );
}

function FinalScore({ gameState, playerColor, opponentName }) {
  if (gameState.status !== "finished" || !gameState.result) return null;

  const { result } = gameState;
  let resultMessage = "Ván cờ hòa.";
  if (result.winner === "black") {
    resultMessage = result.reason === "resignation"
      ? (playerColor === "black" ? "Bạn đã đầu hàng." : `${opponentName} đã đầu hàng.`)
      : (playerColor === "black" ? "Bạn thắng." : `${opponentName} thắng.`);
  } else if (result.winner === "white") {
    resultMessage = result.reason === "resignation"
      ? (playerColor === "white" ? "Bạn đã đầu hàng." : `${opponentName} đã đầu hàng.`)
      : (playerColor === "white" ? "Bạn thắng." : `${opponentName} thắng.`);
  }

  const scoreDetails = result.score
    ? `Đen ${formatScore(result.score.blackTotal)} · Trắng ${formatScore(result.score.whiteTotal)} (gồm 7,5 điểm komi) · ${result.score.neutralArea} điểm trung lập`
    : "Kết thúc do đầu hàng.";

  return (
    <section className="final-score" aria-labelledby="final-score-heading">
      <h2 id="final-score-heading">Kết quả</h2>
      <p className="result-message">{resultMessage}</p>
      <p className="score-details">{scoreDetails}</p>
    </section>
  );
}

function GameStatus({ gameState, isHumanTurn, isComputerThinking, isWaitingForOpponent, opponentName }) {
  let statusText = "Ván cờ đã kết thúc";
  let activeColor = gameState.toMove;

  if (gameState.status !== "finished") {
    statusText = gameState.opponentType === "BOT"
      ? (isComputerThinking ? "KataGo đang tính toán…" : isHumanTurn ? "Đến lượt bạn" : "Đến lượt KataGo")
      : (isWaitingForOpponent ? "Đang chờ người chơi vào phòng…" : isHumanTurn ? "Đến lượt bạn" : `Đến lượt ${opponentName}`);
  }

  return (
    <div className="turn-card" aria-live="polite" aria-atomic="true">
      <span className={`turn-stone turn-stone--${activeColor}`} aria-hidden="true" />
      <div>
        <p className="eyebrow">{gameState.opponentType === "BOT" ? `Lượt đi · KataGo (${getDifficultyLabel(gameState.difficulty, gameState.visits)})` : "Lượt đi · Đấu với người chơi"}</p>
        <p className="game-status">{statusText}</p>
      </div>
    </div>
  );
}

function CaptureRow({ color, player, count }) {
  return (
    <div className="score-row">
      <span className="player-label">
        <span className={`mini-stone mini-stone--${color}`} aria-hidden="true" />
        {color === "black" ? "Đen" : "Trắng"} · {player}
      </span>
      <span className="capture-count">Bắt {count}</span>
    </div>
  );
}

function ActiveGamePage({
  gameState,
  playerProfile,
  isHumanTurn,
  isRequestPending,
  isComputerThinking,
  notice,
  submitAction,
  startNewGame,
}) {
  const canPlay = isHumanTurn && !isRequestPending;
  const [isResignConfirmationOpen, setIsResignConfirmationOpen] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const isHumanGame = gameState.opponentType === "HUMAN";
  const playerColor = isHumanGame && playerProfile
    ? gameState.blackPlayerId === playerProfile.id ? "black" : gameState.whitePlayerId === playerProfile.id ? "white" : null
    : "black";
  const opponentName = isHumanGame ? "Đối thủ" : "KataGo";
  const isWaitingForOpponent = isHumanGame && !gameState.whitePlayerId;

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(gameState.inviteCode || "");
      setIsCodeCopied(true);
      window.setTimeout(() => setIsCodeCopied(false), 1800);
    } catch {
      setIsCodeCopied(false);
    }
  };

  return (
    <main className="game-page" id="main-content" data-enter>
      <header className="game-heading">
        <div>
          <p className="eyebrow">
            Nước {gameState.moveNumber}{isHumanGame ? ` · ${gameState.gameMode === "PRIVATE" ? "Phòng riêng" : "Phòng công khai"}` : ` · ${getDifficultyLabel(gameState.difficulty, gameState.visits)}`}
          </p>
          <h1>{gameState.name || `Bàn ${gameState.size}×${gameState.size}`}</h1>
        </div>
        {gameState.status === "finished" && (
          <button className="button button--secondary" type="button" onClick={startNewGame}>
            Chơi ván mới
          </button>
        )}
      </header>

      {isHumanGame && gameState.inviteCode && (
        <section className="invite-banner" aria-label="Mã mời phòng">
          <div>
            <p className="eyebrow">MÃ MỜI · {gameState.gameMode === "PRIVATE" ? "PHÒNG RIÊNG" : "PHÒNG CÔNG KHAI"}</p>
            <strong className="invite-code">{gameState.inviteCode}</strong>
          </div>
          <button className="button button--secondary" type="button" onClick={copyInviteCode}>
            {isCodeCopied ? "Đã sao chép" : "Sao chép mã"}
          </button>
        </section>
      )}

      <div className="game-layout">
        <section className="board-section" aria-labelledby="board-heading">
          <div className="board-section-heading">
            <h2 id="board-heading">Bàn cờ</h2>
            <p>{canPlay ? "Chạm vào một điểm hoặc dùng phím mũi tên để chọn." : isWaitingForOpponent ? "Gửi mã mời để người chơi Trắng vào phòng." : "Đợi lượt của bạn để đặt quân."}</p>
          </div>
          <GoBoard
            key={gameState.id}
            gameState={gameState}
            canPlay={canPlay}
            onMove={(x, y) => submitAction({ type: "move", x, y })}
          />
        </section>

        <aside className="game-panel" aria-label="Trạng thái ván cờ">
          <GameStatus
            gameState={gameState}
            isHumanTurn={isHumanTurn}
            isComputerThinking={isComputerThinking}
            isWaitingForOpponent={isWaitingForOpponent}
            opponentName={opponentName}
          />
          <div className="capture-list" aria-label="Số quân đã bắt">
            <CaptureRow color="black" player={playerColor === "black" ? "Bạn" : isHumanGame ? "Đối thủ" : "Bạn"} count={gameState.captures.black} />
            <CaptureRow color="white" player={playerColor === "white" ? "Bạn" : opponentName} count={gameState.captures.white} />
          </div>

          <FinalScore gameState={gameState} playerColor={playerColor} opponentName={opponentName} />

          <div className="action-buttons">
            <button
              className="button button--secondary"
              type="button"
              disabled={!canPlay}
              onClick={() => submitAction({ type: "pass" })}
            >
              Bỏ lượt
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={!canPlay}
              onClick={() => setIsResignConfirmationOpen(true)}
            >
              Đầu hàng
            </button>
          </div>
          {isResignConfirmationOpen && gameState.status === "active" && (
            <div className="resign-confirmation" role="group" aria-label="Xác nhận đầu hàng">
              <p>Bạn muốn kết thúc ván cờ này?</p>
              <div className="resign-confirmation-actions">
                <button
                  className="button button--danger"
                  type="button"
                  disabled={!canPlay}
                  onClick={() => {
                    setIsResignConfirmationOpen(false);
                    submitAction({ type: "resign" });
                  }}
                >
                  Xác nhận đầu hàng
                </button>
                <button className="text-link" type="button" onClick={() => setIsResignConfirmationOpen(false)}>
                  Tiếp tục ván
                </button>
              </div>
            </div>
          )}
          <p className="rules-note">
            Hai lượt bỏ liên tiếp kết thúc ván. Đếm điểm theo diện tích; Trắng được cộng 7,5 điểm komi.
          </p>
          <Notice notice={notice} />
        </aside>
      </div>
    </main>
  );
}

export default function PlayPage() {
  const {
    gameState,
    playerProfile,
    isRestoring,
    isRequestPending,
    isComputerThinking,
    isHumanTurn,
    notice,
    canRetryRestore,
    startGame,
    joinGame,
    registerPlayer,
    submitAction,
    startNewGame,
    retryRestore,
  } = useGameSession();

  if (isRestoring) {
    return (
      <main className="loading-page" id="main-content" role="status" aria-live="polite">
        <span className="loading-stone" aria-hidden="true" />
        <p>Đang khôi phục ván cờ…</p>
      </main>
    );
  }

  if (!gameState) {
    return (
      <SetupPage
        playerProfile={playerProfile}
        registerPlayer={registerPlayer}
        isRequestPending={isRequestPending}
        notice={notice}
        canRetryRestore={canRetryRestore}
        startGame={startGame}
        joinGame={joinGame}
        retryRestore={retryRestore}
      />
    );
  }

  return (
    <ActiveGamePage
      gameState={gameState}
      playerProfile={playerProfile}
      isHumanTurn={isHumanTurn}
      isRequestPending={isRequestPending}
      isComputerThinking={isComputerThinking}
      notice={notice}
      submitAction={submitAction}
      startNewGame={startNewGame}
    />
  );
}
