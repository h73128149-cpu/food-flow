"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function Page(){ const router=useRouter(); useEffect(()=>{router.replace("/admin");},[router]); return <div className="p-8 text-center">در حال انتقال به پنل یکپارچه…</div>; }
