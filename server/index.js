const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const controller = require("./middlewares/controller");
const session = require("koa2-session-store");
const MongoStore = require("koa2-session-mongolass");
const convert = require("koa-convert");
const path = require("path");
const render = require("koa-ejs");
const server = require("koa-static");
const config = require("config-lite");
const cors = require("koa2-cors");
const koaWinston = require("./middlewares/koa-winston");

const app = new Koa();
// const isProduction = (process.env.NODE_ENV || 'production') === 'production';
const log = require("./logs/log");
const corsMode = process.argv[2] == "-c" ? true : false;

if (corsMode) {
  app.use(
    cors({
      /*前后端分离时候 运行跨域访问用作 调试*/
      origin: config.cors,
      credentials: true
    })
  );
}

app.use(bodyParser());
app.keys = [config.session.secret];
app.use(
  session({
    name: config.session.key, // 设置 cookie 中保存 session id 的字段名称
    secret: config.session.secret, // 通过设置 secret 来计算 hash 值并放在 cookie 中，使产生的 signedCookie 防篡改
    resave: true, // 强制更新 session
    saveUninitialized: false, // 设置为 false，强制创建一个 session，即使用户未登录
    cookie: {
      maxAge: config.session.maxAge // 过期时间，过期后 cookie 中的 session id 自动删除
    },
    store: new MongoStore()
  })
);

app.use(convert(server(path.join(__dirname, "/build/"))));
app.use(convert(server(path.join(__dirname, "/upload/"))));
render(app, {
  root: path.join(__dirname, "/build/"),
  layout: false,
  viewExt: "html",
  cache: false,
  debug: true
});

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = err.message;
    ctx.app.emit("error", err, ctx);
  }
});
app.use(async (ctx, next) => {
  await next();
  //保证附带cookie
  if (!ctx.session) {
    ctx.session.flag = 1;
  }
  if (ctx.response.status == 404) {
    ctx.response.redirect("/?" + ctx.request.url);
  }
});

// // 正常请求的日志
app.use(koaWinston(log.logger));
// add controller:
app.use(controller());
//错误请求的日志
app.use(koaWinston(log.errorloger));

app.listen(config.port);
