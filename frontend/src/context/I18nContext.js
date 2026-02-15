import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const translations = {
  en: {
    common: {
      login: 'Login',
      register: 'Register',
      logout: 'Logout',
      back: 'Back',
      submit: 'Submit',
      loading: 'Loading...',
      view: 'View',
      viewPdf: 'View PDF',
      create: 'Create',
      cancel: 'Cancel',
      close: 'Close',
      downloadPdf: 'Download Feedback PDF',
      submissions: 'Submissions',
      assignments: 'Assignments',
      classrooms: 'Classrooms',
      classroom: 'Classroom',
      teachers: 'Teachers',
      assistants: 'Assistants',
      users: 'Users',
      title: 'Title',
      description: 'Description',
      adminSecret: 'Admin Secret',
      name: 'Name',
      email: 'Email',
      password: 'Password',
      total: 'Total',
      points: 'Points',
      due: 'Due',
      timeLeft: 'Time left',
      noDeadline: 'No deadline',
      pastDue: 'Past due',
      noAssignmentsFound: 'No assignments found.',
      noSubmissionsFound: 'No submissions found.',
      noClassroomsFound: 'No classrooms found.',
      noTeachersFound: 'No teachers found.',
      noUsersFound: 'No users found.',
    },
    landing: {
      headline: 'Make assignments simple and powerful',
      subhead:
        'We are a web app that helps students and teachers make life easier. We simplify assignments so students can work smarter and achieve higher grades.',
      studentSuccess: 'Student Success',
      teacherEfficiency: 'Teacher Efficiency',
      clearFeedback: 'Clear Feedback',
      organize: 'Organize',
      organizeTitle: 'One hub for every class',
      organizeBody: 'Keep assignments, submissions, and feedback in one place.',
      improve: 'Improve',
      improveTitle: 'Faster grading',
      improveBody: 'Automated scoring and feedback help teachers move quickly.',
      support: 'Support',
      supportTitle: 'Clear next steps',
      supportBody: 'Students always know what to do and how to improve.',
      connect: 'Connect',
      connectTitle: 'Teachers and assistants',
      connectBody: 'Invite assistants to support grading and class updates.',
      startToday: 'Start today',
      startBody: 'Join Sa7a7ly to build clear, organized classrooms with smarter assignments.',
    },
    auth: {
      welcomeBack: 'Welcome back',
      createAccount: 'Create your account',
      loginTitle: 'Login',
      registerStudent: 'Student Registration',
      registerAssistant: 'Assistant Registration',
      loginHelp: 'Enter your email and password to continue.',
      registerHelpStudent: 'Create your student account to access classrooms.',
      registerHelpAssistant: 'Enter your assistant code to complete setup.',
      dontHave: "Don't have an account?",
      alreadyHave: 'Already have an account?',
      loginAsAssistant: 'Login as Assistant',
      backToStudent: 'Back to Student Registration',
      assistantCode: 'Teacher Assistant Code',
    },
    admin: {
      panel: 'Admin Panel',
      overviewAssignments: 'Assignments overview',
      overviewSubmissions: 'Submissions overview',
      overviewClassrooms: 'Classrooms overview',
      teacherManagement: 'Teacher management',
      createTeacher: 'Create Teacher',
      assignmentsOverview: 'Monitor all assignments across classrooms and keep quality consistent.',
      submissionsOverview: 'Review submission flow and keep grading visibility across classes.',
      classroomsOverview: 'Track classroom setup and keep join codes visible.',
      teachersOverview: 'Create teacher accounts and track the teaching team in one place.',
    },
    dashboards: {
      student: 'Student Dashboard',
      teacher: 'Teacher Dashboard',
      assistant: 'Assistant Dashboard',
      welcome: 'Welcome',
    },
    classroom: {
      joinAClassroom: 'Join a Classroom',
      joinCode: 'Join Code',
      shareCode: 'Share this code with students so they can join the classroom.',
      createAssignment: 'Create Assignment',
      manageAssignments: 'Manage assignments',
      manageAssignmentsButton: 'Manage Assignments',
      submitAssignment: 'Submit Assignment',
      viewClassroom: 'View Classroom',
      assignmentsTitle: 'Assignments',
      noAssignments: 'No assignments available yet.',
      noAssignmentsTeacher: 'No assignments yet',
      createFirstAssignment: 'Create your first assignment',
      classroomHub: 'Classroom Hub',
      stayOnTop: 'Stay on top of every assignment',
    },
    submit: {
      submitTitle: 'Submit Assignment',
      resultTitle: 'Submission Result',
      submitted: 'Assignment submitted!',
      gradedByAi: 'Your submission has been graded by AI.',
      feedback: 'Feedback',
      grade: 'Grade',
      requestResubmit: 'Request Resubmission',
      requestReasonPlaceholder: 'Explain why you need to resubmit...',
      resubmitPending: 'Resubmission request pending approval.',
      resubmitDeclined: 'Resubmission request declined.',
      resubmitApproved: 'Resubmission approved. You can submit a new version.',
      submitNewVersion: 'Submit New Version',
      closed: 'Submission is closed. The due date has passed.',
    },
    resubmissions: {
      title: 'Resubmission requests',
      review: 'Review queue',
      approve: 'Approve',
      decline: 'Decline',
      reason: 'Reason',
      noRequests: 'No resubmission requests right now.',
    },
    createAssignment: {
      title: 'Create Assignment',
      descriptionHelp: 'Add clear instructions to help students complete the task.',
      totalPoints: 'Total Points',
      modelAnswer: 'Model Answer PDF',
      dueDate: 'Due Date (Server Time)',
      dueDateHelp: 'Students will see the deadline and time left.',
    },
    createClassroom: {
      title: 'Create Classroom',
      name: 'Classroom Name',
      nameHelp: 'Keep the name short and clear for students.',
    },
  },
  ar: {
    common: {
      login: 'تسجيل الدخول',
      register: 'إنشاء حساب',
      logout: 'تسجيل خروج',
      back: 'رجوع',
      submit: 'تسليم',
      loading: 'جاري التحميل...',
      view: 'عرض',
      viewPdf: 'عرض ملف PDF',
      create: 'إنشاء',
      cancel: 'إلغاء',
      close: 'إغلاق',
      downloadPdf: 'تحميل تقرير التقييم PDF',
      submissions: 'التسليمات',
      assignments: 'التكليفات',
      classrooms: 'الفصول',
      classroom: 'الفصل',
      teachers: 'المدرسين',
      assistants: 'المساعدين',
      users: 'المستخدمين',
      title: 'العنوان',
      description: 'الوصف',
      adminSecret: 'كلمة سر الأدمن',
      name: 'الاسم',
      email: 'الإيميل',
      password: 'كلمة المرور',
      total: 'الإجمالي',
      points: 'الدرجات',
      due: 'موعد التسليم',
      timeLeft: 'الوقت المتبقي',
      noDeadline: 'بدون موعد',
      pastDue: 'متأخر',
      noAssignmentsFound: 'لا توجد تكليفات.',
      noSubmissionsFound: 'لا توجد تسليمات.',
      noClassroomsFound: 'لا توجد فصول.',
      noTeachersFound: 'لا يوجد مدرسين.',
      noUsersFound: 'لا يوجد مستخدمين.',
    },
    landing: {
      headline: 'خلّي التكليفات سهلة وفعّالة',
      subhead:
        'إحنا منصة ويب بتسهّل حياة الطلبة والمدرسين. بنبسط التكليفات عشان الطلبة يشتغلوا بذكاء ويوصلوا لدرجات أعلى.',
      studentSuccess: 'نجاح الطلبة',
      teacherEfficiency: 'كفاءة المدرسين',
      clearFeedback: 'ملاحظات واضحة',
      organize: 'تنظيم',
      organizeTitle: 'مكان واحد لكل فصل',
      organizeBody: 'اجمع التكليفات والتسليمات والملاحظات في مكان واحد.',
      improve: 'تحسين',
      improveTitle: 'تصحيح أسرع',
      improveBody: 'درجات وملاحظات آلية تساعد المدرسين ينجزوا بسرعة.',
      support: 'دعم',
      supportTitle: 'خطوات واضحة',
      supportBody: 'الطالب يعرف يعمل إيه وكيف يتحسّن.',
      connect: 'تواصل',
      connectTitle: 'المدرسين والمساعدين',
      connectBody: 'ضيف مساعدين لدعم التصحيح وتحديثات الفصل.',
      startToday: 'ابدأ النهارده',
      startBody: 'انضم لصححلي لتنظيم فصولك وتكليفاتك بشكل أذكى.',
    },
    auth: {
      welcomeBack: 'أهلًا بعودتك',
      createAccount: 'اعمل حسابك',
      loginTitle: 'تسجيل الدخول',
      registerStudent: 'تسجيل طالب',
      registerAssistant: 'تسجيل مساعد',
      loginHelp: 'اكتب الإيميل وكلمة المرور للمتابعة.',
      registerHelpStudent: 'اعمل حساب الطالب عشان تدخل الفصول.',
      registerHelpAssistant: 'اكتب كود المساعد لإكمال التسجيل.',
      dontHave: 'ما عندكش حساب؟',
      alreadyHave: 'عندك حساب بالفعل؟',
      loginAsAssistant: 'تسجيل كمساعد',
      backToStudent: 'رجوع لتسجيل الطالب',
      assistantCode: 'كود مساعد المدرس',
    },
    admin: {
      panel: 'لوحة الإدارة',
      overviewAssignments: 'نظرة عامة على التكليفات',
      overviewSubmissions: 'نظرة عامة على التسليمات',
      overviewClassrooms: 'نظرة عامة على الفصول',
      teacherManagement: 'إدارة المدرسين',
      createTeacher: 'إنشاء مدرس',
      assignmentsOverview: 'تابع كل التكليفات على كل الفصول.',
      submissionsOverview: 'تابع عملية التسليم والدرجات في كل الفصول.',
      classroomsOverview: 'تابع إعداد الفصول وأكواد الانضمام.',
      teachersOverview: 'أنشئ حسابات المدرسين وادِر الفريق.',
    },
    dashboards: {
      student: 'لوحة الطالب',
      teacher: 'لوحة المدرس',
      assistant: 'لوحة المساعد',
      welcome: 'أهلًا',
    },
    classroom: {
      joinAClassroom: 'انضم لفصل',
      joinCode: 'كود الانضمام',
      shareCode: 'شارك الكود مع الطلبة للانضمام للفصل.',
      createAssignment: 'إنشاء تكليف',
      manageAssignments: 'إدارة التكليفات',
      manageAssignmentsButton: 'إدارة التكليفات',
      submitAssignment: 'تسليم التكليف',
      viewClassroom: 'عرض الفصل',
      assignmentsTitle: 'التكليفات',
      noAssignments: 'لا توجد تكليفات حالياً.',
      noAssignmentsTeacher: 'لا يوجد تكليفات بعد',
      createFirstAssignment: 'أنشئ أول تكليف',
      classroomHub: 'مركز الفصل',
      stayOnTop: 'تابع كل تكليف بسهولة',
    },
    submit: {
      submitTitle: 'تسليم التكليف',
      resultTitle: 'نتيجة التسليم',
      submitted: 'تم تسليم التكليف!',
      gradedByAi: 'تم تصحيح التسليم بالذكاء الاصطناعي.',
      feedback: 'الملاحظات',
      grade: 'الدرجة',
      requestResubmit: 'طلب إعادة تسليم',
      requestReasonPlaceholder: 'اكتب سبب طلب إعادة التسليم...',
      resubmitPending: 'طلب إعادة التسليم قيد المراجعة.',
      resubmitDeclined: 'تم رفض طلب إعادة التسليم.',
      resubmitApproved: 'تم قبول إعادة التسليم. يمكنك إرسال نسخة جديدة.',
      submitNewVersion: 'تسليم نسخة جديدة',
      closed: 'التسليم مقفول. الموعد انتهى.',
    },
    resubmissions: {
      title: 'طلبات إعادة التسليم',
      review: 'قائمة المراجعة',
      approve: 'قبول',
      decline: 'رفض',
      reason: 'السبب',
      noRequests: 'لا يوجد طلبات إعادة تسليم الآن.',
    },
    createAssignment: {
      title: 'إنشاء تكليف',
      descriptionHelp: 'اكتب تعليمات واضحة تساعد الطلبة.',
      totalPoints: 'إجمالي الدرجات',
      modelAnswer: 'ملف إجابة نموذجية PDF',
      dueDate: 'موعد التسليم (بتوقيت السيرفر)',
      dueDateHelp: 'الطلبة هيشوفوا الموعد والوقت المتبقي.',
    },
    createClassroom: {
      title: 'إنشاء فصل',
      name: 'اسم الفصل',
      nameHelp: 'خليه قصير وواضح للطلبة.',
    },
  },
};

const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const t = useMemo(() => {
    const dict = translations[lang] || translations.en;
    return (key) => {
      const parts = key.split('.');
      let value = dict;
      for (const part of parts) {
        value = value?.[part];
      }
      return value || key;
    };
  }, [lang]);

  const toggleLang = () => {
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  return (
    <I18nContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
};
