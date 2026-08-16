use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::net::SocketAddr;

#[derive(Serialize)]
struct Health {
    ok: bool,
    service: &'static str,
    phase: &'static str,
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/health", get(health));
    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    axum::serve(listener, app).await.expect("server");
}

async fn health() -> Json<Health> {
    Json(Health {
        ok: true,
        service: "vibx-backend",
        phase: "scaffold-only",
    })
}
