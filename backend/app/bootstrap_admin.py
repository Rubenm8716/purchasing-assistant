
import getpass

from app.database import get_connection
from app.security import hash_password


def create_admin():
    print("=== Initial Admin Setup ===")

    name = input("Admin name: ").strip()
    email = input("Admin email: ").strip().lower()

    if not name or not email or "@" not in email:
        print("Please provide a valid name and email.")
        return

    password = getpass.getpass("Admin password: ")
    confirmation = getpass.getpass("Confirm password: ")

    if password != confirmation:
        print("Passwords do not match.")
        return

    if len(password) < 12:
        print("Password must be at least 12 characters.")
        return

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin')")
            if cur.fetchone()[0]:
                print("An admin already exists. Setup cancelled.")
                return

            cur.execute(
                """
                INSERT INTO users (
                    name,
                    email,
                    password_hash,
                    role,
                    must_change_password
                )
                VALUES (%s, %s, %s, 'admin', FALSE)
                RETURNING id, name, email, role
                """,
                (name, email, hash_password(password))
            )

            admin = cur.fetchone()

    print("\nAdmin account created successfully!")
    print(f"ID: {admin[0]}")
    print(f"Name: {admin[1]}")
    print(f"Email: {admin[2]}")
    print(f"Role: {admin[3]}")


if __name__ == "__main__":
    create_admin()
