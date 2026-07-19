"""Current-user dependency seam.

Authentication is not implemented yet (out of scope for the current milestone).
This dependency resolves to ``None`` today; once auth exists it will return the
authenticated user's id. Services accept this value as ``actor`` and use it to
populate ``created_by`` / ``updated_by`` (and, later, audit logs), so no service
or router signatures need to change when authentication is introduced.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends


async def get_current_user() -> uuid.UUID | None:
    # No authentication yet — the acting user is unknown.
    return None


CurrentUser = Annotated[uuid.UUID | None, Depends(get_current_user)]
