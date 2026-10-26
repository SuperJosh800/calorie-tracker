/// <reference path="../pb_data/types.d.ts" />

// Each account gets one "backups" record holding its whole diary (the same JSON as Settings → Export backup).
// Only the signed-in owner can read or change their record.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const owner = 'user = @request.auth.id'
    const backups = new Collection({
      type: 'base',
      name: 'backups',
      listRule: owner,
      viewRule: owner,
      createRule: `@request.auth.id != "" && ${owner}`,
      // The owner can't hand their record to someone else.
      updateRule: `${owner} && (@request.body.user:isset = false || @request.body.user = @request.auth.id)`,
      deleteRule: owner,
      fields: [
        { name: 'user', type: 'relation', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true },
        { name: 'data', type: 'json', required: true, maxSize: 20000000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_backups_user ON backups (user)'],
    })
    app.save(backups)

    // Slow down password guessing.
    const settings = app.settings()
    settings.rateLimits.enabled = true
    app.save(settings)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('backups'))
  },
)
