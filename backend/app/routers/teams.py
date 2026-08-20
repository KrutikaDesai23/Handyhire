from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import TeamCreate, TeamDetailResponse, TeamResponse

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("", response_model=list[TeamResponse])
def list_teams(db: Session = Depends(get_db)):
    teams = db.query(models.Team).all()
    response = []
    for team in teams:
        creator = db.query(models.User).filter(models.User.id == team.created_by).first()
        members = db.query(models.TeamMember).filter(models.TeamMember.team_id == team.id).all()
        response.append(
            TeamResponse(
                id=team.id,
                name=team.name,
                description=team.description,
                created_by=team.created_by,
                creator_name=creator.full_name if creator else None,
                role=None,
                members=[
                    {
                        "worker_id": m.worker_id,
                        "role": m.role,
                        "joined_at": m.joined_at.isoformat() if m.joined_at else None,
                    }
                    for m in members
                ],
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
        created_by=team.created_by,
        creator_name=creator.full_name if creator else None,
        members=[
            {
                "worker_id": m.worker_id,
                "role": m.role,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            }
            for m in members
        ],
    )
