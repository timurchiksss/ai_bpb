"""
Telegram bot utilities for sending notifications
"""
from aiogram import Bot
from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID


async def send_telegram_notification(message: str) -> None:
    """
    Send a notification message to a Telegram chat using aiogram.
    
    Args:
        message: The message text to send
        
    Raises:
        ValueError: If Telegram bot token or chat ID is not configured
        TelegramAPIError: If sending the message fails
        Exception: For any other errors during message sending
    """
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        raise ValueError("Telegram bot token or chat ID not configured")
    
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    try:
        await bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=message, parse_mode="Markdown")
    finally:
        await bot.session.close()

