# Nego SDK – Training Your Chatbot

To have the embeddable widget respond as an **AI chatbot** (instead of human chat), you must train it the same way we train the global help chatbot: via **Workflows** and **agent assignment**.

## Overview

- **Without training**: Visitors chat with humans in the room. Someone must reply manually.
- **With training**: Visitors chat with your trained AI agent. It auto-replies based on your configuration.

## How It Works

The widget connects visitors to a Nego room. When that room is **assigned to an AI agent**, the agent auto-replies to every visitor message. The agent’s behavior is defined by the **Workflow** you configure (product, KPIs, instructions).

## Step 1: Configure a Workflow

1. In Nego, go to **Workflows**
2. Choose an agent: **Sales Engineer**, **Marketing Engineer**, or **Receptionist**
3. Fill in the training fields:

| Field | Description |
|-------|-------------|
| **Product / service** | What you sell or offer |
| **KPIs / goals** | What success looks like (e.g. “Answer support questions, qualify leads”) |
| **Instructions** | How the agent should reply (tone, rules, FAQs) |
| **Add from website** | Optional: scrape content from your site |
| **Add from document** | Optional: upload docs for context |

4. Save the workflow

## Step 2: Assign the Room to the Agent

1. Open the room used by your embeddable widget
2. Click **Assign**
3. Choose the agent you configured (Sales Agent, Marketing Agent, or Receptionist)
4. The room is now assigned to that agent

## Step 3: Embed the Widget

1. In the room, click **Invite** → **Embed widget** → **Create embed code**
2. Add the script to your website

## Result

Visitors who open the widget will:

1. Connect to your room
2. Send messages as “Visitor-xxx”
3. Receive **automatic replies** from your trained AI agent
4. Chat as if with a human, but powered by your workflow

## Same Training Model as the Global Help Chatbot

The global Nego help chatbot is trained with a fixed system prompt (app help topics). Your chatbot is trained the same way: you provide context and instructions via Workflows, and the AI replies accordingly. The only difference is the scope: yours is for your product/support, ours is for Nego app help.

## Tips

- **Be specific**: Clear product info and instructions improve replies
- **Include FAQs**: Add common questions and answers to Instructions
- **Use website/document**: Pull in real content for more accurate answers
- **Test**: Send messages from the widget and adjust the workflow if needed
