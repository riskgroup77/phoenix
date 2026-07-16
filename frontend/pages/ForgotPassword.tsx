import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { ArrowLeft, Mail } from 'lucide-react';

/**
 * Parol tiklash hozircha API orqali yo‘q — foydalanuvchini aniq yo‘lga yo‘naltiramiz.
 */
const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  return (
    <AuthLayout title="Parolni tiklash">
      <Card>
        <div className="space-y-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Mail className="h-7 w-7 text-blue-800" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Parolni unutdingizmi?</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Platformada avtomatik parol tiklash hozircha mavjud emas. Iltimos, platforma administratori
              yoki qo‘llab-quvvatlash xizmatiga murojaat qiling — ular hisobingizni tasdiqlab, yangi parol
              o‘rnatishda yordam beradi.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="primary"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft className="h-4 w-4" />
              Kirish sahifasiga qaytish
            </Button>
            <Link to="/register" className="text-sm text-blue-800 hover:text-blue-700">
              Yangi hisob yaratish
            </Link>
          </div>
        </div>
      </Card>
    </AuthLayout>
  );
};

export default ForgotPassword;
