from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import TeamCreate, TeamDetailResponse, TeamResponse

router = APIRouter(prefix="/api/teams", tags=["teams"])


def _build_member_response(m: models.TeamMember) -> dict:
    worker = m.worker
    worker_profile = worker.worker_profile if worker else None
    return {
        "team_member_id": m.id,
        "worker_id": m.worker_id,
        "full_name": worker.full_name if worker else None,
        "profession": worker_profile.profession if worker_profile else None,
        "role": m.role,
        "joined_at": m.joined_at.isoformat() if m.joined_at else None,
    }


@router.get("", response_model=list[TeamResponse])
def list_teams(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Team)

    if search:
        query = query.filter(models.Team.name.ilike(f"%{search}%"))

    if category:
        query = query.filter(models.Team.category == category)

    teams = query.all()
    response = []
    for team in teams:
        creator = db.query(models.User).filter(models.User.id == team.created_by).first()
        members = db.query(models.TeamMember).filter(models.TeamMember.team_id == team.id).all()
        response.append(
            TeamResponse(
                id=team.id,
                name=team.name,
                description=team.description,
                category=team.category,
                created_by=team.created_by,
                creator_name=creator.full_name if creator else None,
                role=None,
                members=[_build_member_response(m) for m in members],
            )
        )
    return response


@router.get("/{team_id}", response_model=TeamDetailResponse)
def get_team(team_id: int, db: Session = Depends(get_db)):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    creator = db.query(models.User).filter(models.User.id == team.created_by).first()
    members = db.query(models.TeamMember).filter(models.TeamMember.team_id == team_id).all()

    return TeamDetailResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        category=team.category,
        created_by=team.created_by,
        creator_name=creator.full_name if creator else None,
        members=[_build_member_response(m) for m in members],
    )
