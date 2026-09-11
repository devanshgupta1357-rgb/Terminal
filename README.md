# DS Terminal (Nexus OS)

An immersive, retro-hacker-themed anonymous real-time chat application built for a specific cohort (Data Science Division). Designed with strict anonymity, auto-vanishing messages, and powerful administrator controls in mind.

## 🚀 Features

*   **Dynamic Anonymity (Ghost Tags):** Instead of real names, users are assigned automatically generated "Ghost Tags" (e.g., `GHOST_ALPHA_15`) that rotate daily based on their unique operator ID.
*   **Auto-Vanishing Messages:** Chat messages automatically fade and vanish from the server and the UI after exactly 60 seconds.
*   **Real-time Communication:** Powered by Socket.IO, messages, administrative locks, and mutes are broadcasted instantly to all connected users.
*   **Strict Access Control:** Hardcoded list of 70 authorized operators. Users log in using their operator ID (`bt25csd001` to `bt25csd070`) and a dynamically generated password.
*   **Admin Dashboard:** The "SUDO_MASTER" admin account has access to dedicated tabs to:
    *   Mute or unmute the entire channel.
    *   Lock or unlock the application.
    *   Review incident reports submitted by users.
    *   Temporarily or permanently block/ban users from logging in (with live kick functionality).
    *   View the real ID behind any Ghost Tag.
    *   Instantly clear all active messages or force logout all connected clients.
*   **Immersive UI:** A hacker-style aesthetic built in React, complete with CRT scanlines, terminal text glows, boot-sequence animations, and raw data layouts.

## 🛠 Tech Stack

*   **Frontend:** React, Vite, Axios, Socket.IO-Client, Lucide-React (Icons).
*   **Backend:** Node.js, Express, Socket.IO, JSON Web Tokens (JWT).
*   **Database:** MongoDB & Mongoose (Stores chat history temporarily, system state, blocked user list, and incident reports).

## 💻 Getting Started Locally

### Prerequisites
*   Node.js installed
*   MongoDB installed and running locally on port 27017

### Installation & Setup

1.  **Clone the Repository & Install Dependencies:**
    ```bash
    # Install backend dependencies
    cd server
    npm install

    # Install frontend dependencies
    cd ../client
    npm install
    ```

2.  **Environment Variables:**
    *   **Backend:** Ensure `.env` in the `server` directory contains:
        ```env
        PORT=5000
        JWT_SECRET=super_secret_ds_terminal_key_2026
        MONGO_URI=mongodb://localhost:27017/ds-terminal
        ```
    *   **Frontend:** Vite defaults backend API to `http://localhost:5000`. If deploying, create `.env` in `client` with `VITE_SERVER_URL=https://your-backend.com`.

3.  **Run Development Servers:**
    ```bash
    # Open Terminal 1
    cd server
    npm run dev

    # Open Terminal 2
    cd client
    npm run dev
    ```
4.  Navigate to `http://localhost:5173/` in your browser.

## 🔐 Operator Credentials

*   **Normal User Login:** ID (`bt25csd001` - `bt25csd070`), Password (`[ID]2026!`)
*   **Admin Login:** ID (`bt25csd064`), Password (`bt25csd0641357!`)