"""Günlük veri toplama ve skor yeniden hesaplama planlayıcısı."""
from __future__ import annotations

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .analytics import recompute_all_scores
from .collector import collect_all
from .config import settings
from .db import SessionLocal
from .site_coverage import update_gap_history
from .search_console import sync_recent as sc_sync_recent

logger = logging.getLogger(__name__)
_scheduler: BackgroundScheduler | None = None


def _daily_job():
    logger.info("[scheduler] daily collection starting")
    try:
        result = collect_all()
        logger.info("[scheduler] collection result: %s", result)
    except Exception as e:
        logger.exception("[scheduler] collection failed: %s", e)
        return

    db = SessionLocal()
    try:
        n = recompute_all_scores(db)
        logger.info("[scheduler] recomputed %d scores", n)
        try:
            gap_result = update_gap_history(db)
            logger.info("[scheduler] gap history updated: %s", gap_result)
        except Exception as e:
            logger.warning("[scheduler] gap history update failed: %s", e)

        try:
            sc_result = sc_sync_recent(db, days=28)
            logger.info("[scheduler] search console synced: %s", sc_result)
        except Exception as e:
            logger.warning("[scheduler] search console sync failed: %s", e)
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    sched = BackgroundScheduler(timezone=settings.timezone)
    sched.add_job(
        _daily_job,
        CronTrigger(hour=settings.collect_hour, minute=settings.collect_minute),
        id="daily_collect",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    sched.start()
    _scheduler = sched
    logger.info(
        "[scheduler] started; daily job at %02d:%02d %s",
        settings.collect_hour, settings.collect_minute, settings.timezone,
    )
    return sched


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
