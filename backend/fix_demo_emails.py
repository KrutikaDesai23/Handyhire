"""Fix demo email addresses to use a non-reserved domain."""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from app.database.connection import engine
from app.models import User

load_dotenv(dotenv_path=os.path.join(BACKEND_DIR, ".env"))

session = Session(bind=engine)
try:
    customer = session.query(User).filter(User.email == "demo.customer@handyhire.test").first()
    if customer:
        customer.email = "demo.customer@handyhire.com"

    worker1 = session.query(User).filter(User.email == "demo.worker.alpha@handyhire.test").first()
    if worker1:
        worker1.email = "demo.worker.alpha@handyhire.com"

    worker2 = session.query(User).filter(User.email == "demo.worker.beta@handyhire.test").first()
    if worker2:
        worker2.email = "demo.worker.beta@handyhire.com"

    session.commit()
    print("Updated demo emails to @handyhire.com")
finally:
    session.close()
