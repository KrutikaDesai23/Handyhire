from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import TeamCreate, TeamResponse

router = APIRouter(prefix="/api/worker/teams", tags=["worker-teams"])


def _build_member_response(m: models.TeamMember) -> dict:
    worker = m.worker
    worker_profile = worker.worker_profile if worker else None
    return {
        "worker_id": m.worker_id,
        "full_name": worker.full_name if worker else None,
        "profession": worker_profile.profession if worker_profile else None,
        "role": m.role,
        "joined_at": m.joined_at.isoformat() if m.joined_at else None,
    }


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreate = Body(...),
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    team = models.Team(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        created_by=current_user.id,
    )
    db.add(team)
    db.flush()

    membership = models.TeamMember(
        team_id=team.id,
        worker_id=current_user.id,
        role="creator",
    )
    db.add(membership)
    db.commit()
    db.refresh(team)

    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        category=team.category,
        created_by=team.created_by,
        creator_name=current_user.full_name,
        role="creator",
        members=[_build_member_response(membership)],
    )


@router.post("/{team_id}/members", response_model=TeamResponse)
def add_team_member(
    team_id: int,
    worker_id: int = Body(..., embed=True),
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    if team.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the team creator can manage members")

    worker = db.query(models.User).filter(models.User.id == worker_id, models.User.role == "worker").first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")

    existing = db.query(models.TeamMember).filter(models.TeamMember.team_id == team_id, models.TeamMember.worker_id == worker_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Worker is already a team member")

    member = models.TeamMember(team_id=team_id, worker_id=worker_id, role="member")
    db.add(member)
    db.commit()
    db.refresh(team)

    members = db.query(models.TeamMember).filter(models.TeamMember.team_id == team_id).all()
    creator = db.query(models.User).filter(models.User.id == team.created_by).first()
    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        category=team.category,
        created_by=team.created_by,
        creator_name=creator.full_name if creator else None,
        role="creator",
        members=[_build_member_response(m) for m in members],
    )


@router.delete("/{team_id}/members/{worker_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    team_id: int,
    worker_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    if team.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the team creator can manage members")

    member = db.query(models.TeamMember).filter(models.TeamMember.team_id == team_id, models.TeamMember.worker_id == worker_id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if member.role == "creator":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove the team creator")

    db.delete(member)
    db.commit()
