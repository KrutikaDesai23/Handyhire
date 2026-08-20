from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import TeamResponse

router = APIRouter(prefix="/api/worker", tags=["worker"])


@router.get("/teams", response_model=list[TeamResponse])
def list_worker_teams(
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    memberships = db.query(models.TeamMember).filter(models.TeamMember.worker_id == current_user.id).all()
    team_ids = [m.team_id for m in memberships]
    created_teams = db.query(models.Team).filter(models.Team.created_by == current_user.id).all()
    team_ids.extend([t.id for t in created_teams])
    unique_team_ids = list(set(team_ids))

    teams = db.query(models.Team).filter(models.Team.id.in_(unique_team_ids)).all()
    response = []
    for team in teams:
        membership = db.query(models.TeamMember).filter(models.TeamMember.team_id == team.id, models.TeamMember.worker_id == current_user.id).first()
        members = db.query(models.TeamMember).filter(models.TeamMember.team_id == team.id).all()
        response.append(
            TeamResponse(
                id=team.id,
                name=team.name,
                description=team.description,
                created_by=team.created_by,
                role=membership.role if membership else ("creator" if team.created_by == current_user.id else None),
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
