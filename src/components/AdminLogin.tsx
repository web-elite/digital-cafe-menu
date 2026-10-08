import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import Icon from "./Icon";
import { routeLinks } from "../lib/router";
import "../admin.css";

type Props = {
  businessName: string;
  logo?: string;
  onLogin: (username: string, password: string) => Promise<boolean> | boolean;
  onBack: () => void;
};

export default function AdminLogin({ businessName, logo = "", onLogin, onBack }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const usernameId = useId();
  const passwordId = useId();
  const errorId = useId();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const success = await Promise.resolve(onLogin(username, password));
    if (success) {
      setPassword("");
      return;
    }
    setError("نام کاربری یا رمز عبور نادرست است.");
    setPassword("");
    passwordRef.current?.focus();
  };

  return (
    <main className="admin-screen admin-login-screen">
      <header className="admin-login-topbar">
        <a href={routeLinks.admin()} className="admin-brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="admin-brand-mark">{logo ? <img src={logo} alt="" /> : "S"}</span>
          <div><strong>کافه {businessName}</strong><small>STAGE · ADMIN ACCESS</small></div>
        </a>
        <a
          href="#/"
          className="admin-text-button"
          onClick={(event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey) return;
            event.preventDefault();
            onBack();
          }}
        >
          <span>بازگشت به کافه</span>
          <Icon name="arrow-left" />
        </a>
      </header>

      <div className="admin-login-content">
        <section className="admin-login-section" aria-labelledby="admin-login-title">
          <span className="admin-login-symbol"><Icon name="lock" /></span>
          <p className="admin-login-eyebrow">MENU MANAGEMENT</p>
          <h1 id="admin-login-title">ورود به مدیریت</h1>
          <p className="admin-login-description">برای ویرایش منو و قیمت‌ها، با حساب مدیر وارد شوید.</p>

          <form className="admin-login-form" onSubmit={submit}>
            <label className="admin-field" htmlFor={usernameId}>
              <span>نام کاربری</span>
              <input
                id={usernameId}
                name="username"
                type="text"
                dir="ltr"
                value={username}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                required
                maxLength={100}
                placeholder="نام کاربری"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => { setUsername(event.target.value); setError(""); }}
              />
            </label>

            <div className="admin-field">
              <label htmlFor={passwordId}>رمز عبور</label>
              <div className="admin-login-password">
                <input
                  id={passwordId}
                  name="password"
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  value={password}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  maxLength={200}
                  placeholder="رمز عبور"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(event) => { setPassword(event.target.value); setError(""); }}
                />
                <button className="admin-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"} aria-pressed={showPassword}><Icon name={showPassword ? "eye-off" : "eye"} /></button>
              </div>
            </div>

            {error && <p className="admin-login-error" id={errorId} role="alert">{error}</p>}
            <button className="admin-button admin-login-submit" type="submit"><span>ورود به داشبورد</span><Icon name="arrow-left" /></button>
          </form>

          <p className="admin-login-session-note">ورود در همین تب مرورگر، تا خروج از حساب یا حداکثر ۸ ساعت حفظ می‌شود.</p>
        </section>
      </div>

      <footer className="admin-login-footer">STAGE · COFFEE TO GO</footer>
    </main>
  );
}