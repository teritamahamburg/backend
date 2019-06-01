import Koa from 'koa';
import BodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import Serve from 'koa-static';
// import Graphql

const app = new Koa();
app.use(BodyParser());

const router = new Router();

app.use(router.routes());
app.use(router.allowedMethods());

app.use(Serve('public'));

const port = process.env.PORT || 8081;
app.listen(port, () => {
  console.log(` listen: http://localhost:${port}`);
  console.log(`graphql: http://localhost:${port}/graphql`);
});
