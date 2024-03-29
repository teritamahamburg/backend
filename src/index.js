import Koa from 'koa';
import BodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import Serve from 'koa-static';
import apiFallback from 'koa-history-api-fallback';
import GraphQLMiddleware from './GraphQLMiddleware';
import db from './sequelize/models/index';

const app = new Koa();
app.use(BodyParser());

const gql = new GraphQLMiddleware(db);
gql.middleware(app);

const router = new Router();

if (process.env.NODE_ENV === 'test') {
  router.del('/db_reset', async (ctx) => {
    await db.sequelize.dropAllSchemas();
    await db.sequelize.sync({ force: true });
    ctx.status = 200;
  });
}

app.use(router.routes());
app.use(router.allowedMethods());

app.use(Serve('storage'));

app.use(Serve('public'));
app.use(apiFallback());
app.use(Serve('public'));

(async () => {
  await db.sequelize.sync();

  const port = process.env.PORT || 8081;
  app.listen(port, () => {
    /* eslint-disable no-console */
    console.log(` listen: http://localhost:${port}`);
    console.log(`graphql: http://localhost:${port}${gql.server.graphqlPath}`);
  });
})();
