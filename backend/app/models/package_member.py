from sqlalchemy import Column, Integer, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import relationship

from app.database.connection import Base


class PackageMember(Base):
    __tablename__ = "package_members"

    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False)
    team_member_id = Column(Integer, ForeignKey("team_members.id"), nullable=False)

    team_member = relationship("TeamMember")

    __table_args__ = (
        PrimaryKeyConstraint(package_id, team_member_id),
    )
