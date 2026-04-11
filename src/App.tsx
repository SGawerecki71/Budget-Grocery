import "./App.css";

export default function App() {
  return (
    <div className="container">
      <h1>Welcome to Your App</h1>
      <p>Start building your project here</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 24, textAlign: "left" }}>
      <h1>Todo App</h1>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a todo..."
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={addTodo}>Add</button>
      </div>

      <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
        {todos.map((t) => (
          <li
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid #333",
              gap: 12,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <input type="checkbox" checked={t.completed === 1} onChange={() => toggleTodo(t)} />
              <span style={{ textDecoration: t.completed === 1 ? "line-through" : "none" }}>
                {t.name}
              </span>
            </label>

            <button onClick={() => deleteTodo(t.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
