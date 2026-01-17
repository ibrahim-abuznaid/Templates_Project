-- CreateTable
CREATE TABLE "template_analytics" (
    "id" SERIAL NOT NULL,
    "template_id" VARCHAR(255) NOT NULL,
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "total_installs" INTEGER NOT NULL DEFAULT 0,
    "active_flow_ids" TEXT[],
    "installed_by_user_ids" TEXT[],
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "explore_analytics" (
    "id" SERIAL NOT NULL,
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "viewed_by_user_ids" TEXT[],
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "explore_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_analytics_template_id_key" ON "template_analytics"("template_id");

-- CreateIndex
CREATE INDEX "idx_template_analytics_template_id" ON "template_analytics"("template_id");
