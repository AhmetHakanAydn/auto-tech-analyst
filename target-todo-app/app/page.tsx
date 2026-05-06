"use client";
import { useState } from "react";

type View = "login" | "register" | "dashboard";
type User = { email: string };

function Login({ onLogin, onSwitch }: { onLogin: (u: User) => void; onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (email) onLogin({ email }); }}
      className="mx-auto mt-24 w-80 space-y-3 rounded-lg bg-white p-6 shadow"
    >
      <h1 className="text-xl font-semibold">Login</h1>
      <input
        className="w-full rounded border px-3 py-2"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input className="w-full rounded border px-3 py-2" type="password" placeholder="password" />
      <button className="w-full rounded bg-blue-600 py-2 text-white">Sign in</button>
      <button type="button" onClick={onSwitch} className="text-sm text-blue-600">
        No account? Register
      </button>
    </form>
  );
}

function Register({ onRegister, onSwitch }: { onRegister: (u: User) => void; onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (email) onRegister({ email }); }}
      className="mx-auto mt-24 w-80 space-y-3 rounded-lg bg-white p-6 shadow"
    >
      <h1 className="text-xl font-semibold">Register</h1>
      <input
        className="w-full rounded border px-3 py-2"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input className="w-full rounded border px-3 py-2" type="password" placeholder="password" />
      <button className="w-full rounded bg-green-600 py-2 text-white">Create account</button>
      <button type="button" onClick={onSwitch} className="text-sm text-blue-600">
        Have an account? Login
      </button>
    </form>
  );
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [todos, setTodos] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  return (
    <div className="mx-auto mt-12 w-96 space-y-3 rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hi, {user.email}</h1>
        <button onClick={onLogout} className="text-sm text-red-600">Logout</button>
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="new todo"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          onClick={() => { if (draft) { setTodos([...todos, draft]); setDraft(""); } }}
          className="rounded bg-blue-600 px-3 text-white"
        >
          Add
        </button>
      </div>
      <ul className="space-y-1">
        {todos.map((t, i) => (
          <li key={i} className="rounded border px-3 py-1">{t}</li>
        ))}
      </ul>
    </div>
  );
}

export default function Page() {
  const [view, setView] = useState<View>("login");
  const [user, setUser] = useState<User | null>(null);

  const enter = (u: User) => { setUser(u); setView("dashboard"); };
  const logout = () => { setUser(null); setView("login"); };

  if (view === "dashboard" && user) return <Dashboard user={user} onLogout={logout} />;
  if (view === "register") return <Register onRegister={enter} onSwitch={() => setView("login")} />;
  return <Login onLogin={enter} onSwitch={() => setView("register")} />;
}
