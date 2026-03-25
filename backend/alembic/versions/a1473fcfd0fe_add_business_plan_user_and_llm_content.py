"""add business plan user and llm content

Revision ID: a1473fcfd0fe
Revises: d2f6b8ab1337
Create Date: 2026-01-15 19:52:04.645281

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1473fcfd0fe'
down_revision: Union[str, Sequence[str], None] = 'd2f6b8ab1337'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Rename content to user_content to preserve existing data
    op.alter_column('business_plans', 'content', new_column_name='user_content')
    
    # Add llm_content column as nullable (no server default)
    op.add_column('business_plans', sa.Column('llm_content', sa.Text(), nullable=True))
    
    # Populate llm_content with empty string for all existing rows
    op.execute("UPDATE business_plans SET llm_content = ''")
    
    # Make llm_content non-nullable now that all rows have values
    op.alter_column('business_plans', 'llm_content', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop llm_content column
    op.drop_column('business_plans', 'llm_content')
    
    # Rename user_content back to content
    op.alter_column('business_plans', 'user_content', new_column_name='content')
