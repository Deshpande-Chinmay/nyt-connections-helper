# NYT Connections Helper

A simple visualizer for NYT Connections players to map out word categories without risking in-game streaks or missing reverse rainbows.

**[Website Hosted on Vercel](https://nyt-connections-helper.vercel.app/)**

## Features
* **Interactive Grid:** Move word tiles on the grid to try different groups, before finalizing in-game.
* **Category Color-Coding:** Give each tile NYT Connections based colours and group them together.
* **Wide Compatibility:** Tiles & grid function tailored for different kinds of devices.
* **Edge Proxy Routing:** Uses a Cloudflare Worker proxy (`proxy-worker.js`) to cache grid data and load puzzles faster.

## Tools used
* **Frontend:** Vanilla Javascript (ES6+), HTML5, CSS3
* **AI Tools:** Anthropic's Claude - Used for code generation, debugging and Cloudflare Worker proxy scripting.
* **Deployment:** Vercel

## Local Setup
1. Clone the repository: `git clone https://github.com/Deshpande-Chinmay/nyt-connections-helper`
2. Open the project folder
3. Open `index.html` in your web browser to run the application locally.
