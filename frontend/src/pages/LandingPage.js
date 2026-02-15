import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../images/image.png';

const LandingPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    React.useEffect(() => {
        if (user) {
            if (user.role === 'ADMIN') {
                navigate('/admin/users');
            } else if (user.role === 'TEACHER') {
                navigate('/teacher-dashboard');
            } else if (user.role === 'ASSISTANT') {
                navigate('/assistant-dashboard');
            } else {
                navigate('/student-dashboard');
            }
        }
    }, [user, navigate]);

    return ( <
        div className = "min-h-screen bg-slate-50" >
        <
        div className = "relative overflow-hidden" >
        <
        div className = "absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl" / >
        <
        div className = "absolute -bottom-28 right-10 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" / >
        <
        div className = "relative mx-auto flex min-h-[75vh] max-w-7xl flex-col gap-10 px-4 py-16 lg:flex-row lg:items-center" >
        <
        div className = "max-w-2xl" >
        <
        div className = "flex items-center gap-3" >
        <
        img src = { logo }
        alt = "Sa7a7ly logo"
        className = "h-12 w-12 rounded-xl bg-white p-2 shadow" /
        >
        <
        div >
        <
        p className = "text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700" >
        Sa7a7ly <
        /p> <
        h1 className = "text-4xl font-bold text-slate-900 sm:text-5xl" >
        Make assignments simple and powerful <
        /h1> <
        /div> <
        /div> <
        p className = "mt-6 text-lg leading-relaxed text-slate-700" >

        <
        /p> <
        div className = "mt-8 flex flex-wrap gap-4" >
        <
        button onClick = {
            () => navigate('/login') }
        className = "px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition" >
        Login <
        /button> <
        button onClick = {
            () => navigate('/register') }
        className = "px-6 py-3 bg-white text-emerald-700 border border-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition" >
        Register <
        /button> <
        /div> <
        div className = "mt-8 flex flex-wrap gap-3" >
        <
        span className = "rounded-full bg-emerald-600 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white" >
        Student Success <
        /span> <
        span className = "rounded-full bg-sky-600 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white" >
        Teacher Efficiency <
        /span> <
        span className = "rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white" >
        Clear Feedback <
        /span> <
        /div> <
        /div>

        <
        div className = "w-full max-w-xl" >
        <
        div className = "grid grid-cols-1 gap-4 sm:grid-cols-2" >
        <
        div className = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" >
        <
        p className = "text-sm font-semibold uppercase tracking-[0.2em] text-slate-500" >
        Organize <
        /p> <
        h3 className = "mt-2 text-xl font-bold text-slate-900" >
        One hub
        for every class <
        /h3> <
        p className = "mt-2 text-sm text-slate-600" >
        Keep assignments, submissions, and feedback in one place. <
        /p> <
        /div> <
        div className = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" >
        <
        p className = "text-sm font-semibold uppercase tracking-[0.2em] text-slate-500" >
        Improve <
        /p> <
        h3 className = "mt-2 text-xl font-bold text-slate-900" >
        Faster grading <
        /h3> <
        p className = "mt-2 text-sm text-slate-600" >
        Automated scoring and feedback help teachers move quickly. <
        /p> <
        /div> <
        div className = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" >
        <
        p className = "text-sm font-semibold uppercase tracking-[0.2em] text-slate-500" >
        Support <
        /p> <
        h3 className = "mt-2 text-xl font-bold text-slate-900" >
        Clear next steps <
        /h3> <
        p className = "mt-2 text-sm text-slate-600" >
        Students always know what to do and how to improve. <
            /p> <
            /div> <
            div className = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" >
            <
            p className = "text-sm font-semibold uppercase tracking-[0.2em] text-slate-500" >
            Connect <
            /p> <
            h3 className = "mt-2 text-xl font-bold text-slate-900" >
            Teachers and assistants <
            /h3> <
            p className = "mt-2 text-sm text-slate-600" >
            Invite assistants to support grading and class updates. <
            /p> <
            /div> <
            /div> <
            div className = "mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6" >
            <
            p className = "text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700" >
            Start today <
            /p> <
            p className = "mt-2 text-slate-700" >
            Join Sa7a7ly to build clear, organized classrooms with smarter
        assignments. <
        /p> <
        /div> <
        /div> <
        /div> <
        /div> <
        /div>
    );
};

export default LandingPage;