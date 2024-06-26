import passport from 'passport';
import localStrategy from 'passport-local';
import GithubStrategy from 'passport-github2';
import UserModel from '../dao/models/user.model.js';
import { hasAdminCredentials } from "../public/js/authMiddleware.js";
import bcrypt from 'bcryptjs';
import config from './config.js';

// Datos de configuración de la estrategia de autenticación con Github
const githubClientID = config.githubClientId;
const githubClientSecret = config.githubClientSecret;

const initializePassport = () => {

  passport.use('register', new localStrategy({
    passReqToCallback: true,
    usernameField: 'email',
  }, async (req, username, password, done) => {
    const { first_name, last_name, email, age } = req.body;
    try {
      const user = await UserModel.findOne({ email: username });
      if (user) {
        return done(null, false, { message: 'El correo electrónico ya está en uso.' });
      }

      // Verificar si las credenciales son de administrador
      const isAdminCredentials = hasAdminCredentials(email, password);

      // Encriptar la contraseña utilizando bcryptjs
      const saltRounds = 10; // Número de rondas de encriptación (mayor número, más seguro pero más lento)
      const hashedPassword = bcrypt.hashSync(password, saltRounds);
      const newUser = new UserModel({
        first_name,
        last_name,
        email,
        age,
        password: hashedPassword, // Guardamos la contraseña encriptada
        role: isAdminCredentials ? 'admin' : 'usuario'
      });

      await newUser.save();

      const userNew = {
        _id: newUser._id,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        email: newUser.email,
        age: newUser.age,
        role: newUser.role
      }

      // Almacenar toda la información del usuario en la sesión
      // req.session.user = userNew;

      return done(null, newUser);
    } catch (error) {
      console.log(error.message);
      return done(error);
    }
  }));

  passport.use('login', new localStrategy({
    usernameField: 'email',
    passReqToCallback: true
  }, async (req, username, password, done) => {
    try {
      const user = await UserModel.findOne({ email: username });
      if (!user) {
        return done(null, false, { message: 'Credenciales inválidas.' });
      }
      const passwordsMatch = await bcrypt.compareSync(password, user.password);
      if (!passwordsMatch) {
        return done(null, false, { message: 'Credenciales inválidas.' });
      }
      const userSession = {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        age: user.age,
        role: user.role
      }
      req.session.user = userSession;
      return done(null, userSession);
    } catch (error) {
      console.log(error.message);
      return done(error);
    }
  }));

  passport.use('github', new GithubStrategy({
    clientID: githubClientID,
    clientSecret: githubClientSecret,
    callbackURL: 'http://localhost:8080/api/sessions/githubcallback'
  }, async (accessToken, refreshToken, profile, done) => {
    console.log(profile)
    try {
      const user = await UserModel.findOne({ email: profile._json.email })
      if (user) return done(null, user)
      const newUser = await UserModel.create({
        first_name: profile._json.name,
        last_name: " ",
        email: profile._json.email,
        age: 0,
        password: " "
      })
      return done(null, newUser)
    }
    catch (error) {
      console.log(error.message)
      return done('Error al intentar loguearse con Github.')
    }
  }));

  passport.serializeUser((user, done) => {
    done(null, user._id);
  })
  passport.deserializeUser(async (id, done) => {
    const user = await UserModel.findById(id);
    done(null, user);
  })

}

export default initializePassport;