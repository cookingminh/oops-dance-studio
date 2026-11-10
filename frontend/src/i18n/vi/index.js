import common from './common';
import home from './home';
import auth from './auth';
import adminStudio from './adminStudio';
import adminPeople from './adminPeople';
import profile from './profile';
import payroll from './payroll';
import about from './about';
import account from './account';
import tuition from './tuition';
import tuitionStaff from './tuitionStaff';
import finance from './finance';
import expenses from './expenses';
import classSwitch from './classSwitch';
import routines from './routines';
import classHub from './classHub';
import calendar from './calendar';
import attendanceHub from './attendanceHub';
import activity from './activity';

// One flat English → Vietnamese map. Areas live in their own files; later files win on clashes.
export default { ...common, ...home, ...auth, ...adminStudio, ...adminPeople, ...profile, ...payroll, ...about, ...account, ...tuition, ...tuitionStaff, ...finance, ...expenses, ...classSwitch, ...routines, ...classHub, ...calendar, ...attendanceHub, ...activity };
