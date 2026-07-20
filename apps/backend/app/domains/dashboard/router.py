"""Operations Dashboard REST API (thin controller)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.domains.dashboard.schemas import OperationsDashboard
from app.domains.dashboard.service import DashboardService
from app.shared.schemas import DataResponse

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


def get_dashboard_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DashboardService:
    return DashboardService(session)


ServiceDep = Annotated[DashboardService, Depends(get_dashboard_service)]


@router.get("/operations", response_model=DataResponse[OperationsDashboard])
async def get_operations_dashboard(service: ServiceDep) -> DataResponse[OperationsDashboard]:
    data = await service.get_operations_dashboard()
    return DataResponse[OperationsDashboard](data=data)
