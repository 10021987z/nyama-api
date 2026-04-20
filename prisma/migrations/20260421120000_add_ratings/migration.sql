-- Rating — notation post-livraison (3 notes + tags + commentaire)
-- Créée lorsqu'un client soumet POST /orders/:id/rating sur une commande DELIVERED.
-- 1-to-1 avec Order (orderId unique).
CREATE TABLE "Rating" (
    "id"              TEXT        NOT NULL,
    "orderId"         TEXT        NOT NULL,
    "clientId"        TEXT        NOT NULL,
    "riderStars"      INTEGER     NOT NULL,
    "restaurantStars" INTEGER     NOT NULL,
    "appStars"        INTEGER     NOT NULL,
    "comment"         TEXT,
    "tags"            TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Rating_orderId_key" ON "Rating"("orderId");
CREATE INDEX "Rating_clientId_idx" ON "Rating"("clientId");
CREATE INDEX "Rating_createdAt_idx" ON "Rating"("createdAt");

ALTER TABLE "Rating"
    ADD CONSTRAINT "Rating_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Rating"
    ADD CONSTRAINT "Rating_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
