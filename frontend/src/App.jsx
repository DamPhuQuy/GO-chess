import { Link, Route, Switch, useLocation } from "wouter";
import { GameSessionProvider } from "./context/GameSessionContext.jsx";
import DocsPage from "./pages/DocsPage.jsx";
import PlayPage from "./pages/PlayPage.jsx";
import { useGameSession } from "./context/GameSessionContext.jsx";

function NotFoundPage() {
  return (
    <main className="not-found-page" id="main-content" data-enter>
      <p className="eyebrow">404 · KHÔNG TÌM THẤY</p>
      <h1>Trang này không tồn tại</h1>
      <p className="page-intro">Hãy quay lại bàn cờ hoặc mở cẩm nang luật chơi.</p>
      <div className="not-found-actions">
        <Link className="button button--primary" href="/">Quay lại bàn cờ</Link>
        <Link className="text-link" href="/docs">Đọc luật chơi</Link>
      </div>
    </main>
  );
}

function AppRoutes() {
  const [location] = useLocation();
  const { gameState, playerProfile } = useGameSession();
  const playerColor = gameState?.opponentType === "HUMAN" && playerProfile
    ? gameState.blackPlayerId === playerProfile.id ? "Đen" : gameState.whitePlayerId === playerProfile.id ? "Trắng" : null
    : gameState ? "Đen" : null;

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
        <div className="header-inner">
          <Link className="wordmark" href="/" aria-label="Cờ Vây — trang chơi">
            <span className="wordmark-stone" aria-hidden="true" />
            <span>CỜ VÂY</span>
          </Link>
          <nav className="site-nav" aria-label="Điều hướng chính">
            <Link href="/" aria-current={location === "/" ? "page" : undefined}>Chơi cờ</Link>
            <Link href="/docs" aria-current={location === "/docs" ? "page" : undefined}>Luật chơi</Link>
          </nav>
          <span className="header-note">{playerProfile ? `Người chơi · ${playerProfile.username}` : "9×9 · 19×19"}</span>
        </div>
      </header>

      <Switch>
        <Route path="/" component={PlayPage} />
        <Route path="/docs" component={DocsPage} />
        <Route component={NotFoundPage} />
      </Switch>

      <footer className="site-footer">
        <span>Cờ Vây</span>
        <span className="footer-divider" aria-hidden="true">·</span>
        <span>{playerColor ? `Bạn cầm ${playerColor}${playerColor === "Đen" ? " và đi trước" : ""}` : "Bạn chọn Đen và đi trước"}</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <GameSessionProvider>
      <AppRoutes />
    </GameSessionProvider>
  );
}
