# HINTLAB: An Interactive Tool for Hint Generation, Analysis and Evaluation

> A comprehensive framework for generating, analyzing, and systematically evaluating pedagogical hints — built for researchers and educators.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
  - [1. Set Up the Environment](#1-set-up-the-virtual-environment)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Run the System](#4-run-the-system)
---

## 📖 Overview

**HINTLAB** is a comprehensive tool designed for the generation and systematic evaluation of hints. The goal of this system is to provide a standardized environment where users can generate hints using various strategies (based on the HintEval framework), analyze their structure, and evaluate their effectiveness, quality, and pedagogical value.

---

## 🏗️ Architecture

The framework consists of two core components:

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| 🐍 **Backend** | Python · FastAPI | Hint generation logic, dataset processing, evaluation metrics |
| ⚛️ **Frontend** | Node.js · Next.js | Interactive hint generation, analysis, and visualization UI |

---

## ✅ Prerequisites

Before proceeding, ensure you have the following installed on your machine:

- **Miniconda or Anaconda** — for virtual environment management
- **Python 3.11.9** — required interpreter version
- **Node.js & npm** — required for the frontend

---

## 🚀 Getting Started

### 1. Set Up the Virtual Environment

Create and activate a dedicated Conda environment to keep dependencies isolated:

```bash
# Create the environment
conda create -n hinteval_env python=3.11.9 --no-default-packages

# Activate the environment
conda activate hinteval_env
```

### 2. Install Dependencies

With the environment active, install all required Python packages:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

HINTLAB requires two separate `.env` files — one for the backend and one for the frontend.

#### 🔧 Backend — `/source/backend/.env`

Create the file and populate it with the following:

```env
# AI Model Configuration
TOGETHER_API_KEY="your_api_key_here"
TOGETHER_BASE_URL="https://api.together.xyz/v1"

# Database Configuration
DB_HOST="your_hostname"
DB_NAME="your_database_name"
DB_USER="your_database_user"
DB_PASS="your_database_password"
```

> **Note:** `TOGETHER_API_KEY` must contain a valid API key from [Together AI](https://www.together.ai/). The `DB_*` variables should match your PostgreSQL instance credentials.

#### 🎨 Frontend — `/source/frontend/hinteval-ui/.env.local`

Create the file and populate it with the following:

```env
NEXT_PUBLIC_HINTEVAL_API=http://your_backend_address_here
```

### 4. Run the System

**Start the backend** by navigating to the directory containing `app.py` and running:

```bash
python app.py
```

**Start the frontend** by navigating to the `hinteval-ui` directory and running:

```bash
npm run start
```

The frontend will connect to the backend via the address defined in your `.env.local` file.

---
