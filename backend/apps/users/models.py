from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils.translation import gettext_lazy as _
import uuid


class UserManager(BaseUserManager):
    """Custom user manager"""
    
    def create_user(self, phone, password=None, **extra_fields):
        """Create and return a regular user"""
        if not phone:
            raise ValueError(_('Phone number is required'))
        
        user = self.model(phone=phone, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, phone, password=None, **extra_fields):
        """Create and return a superuser"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'super_admin')
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))
        
        return self.create_user(phone, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User model"""
    
    ROLE_CHOICES = (
        ('author', 'Author'),
        ('reviewer', 'Reviewer'),
        ('journal_admin', 'Journal Admin'),
        ('super_admin', 'Super Admin'),
        ('accountant', 'Accountant'),
        ('operator', 'Operator'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(_('phone number'), max_length=20, unique=True)
    email = models.EmailField(_('email address'), unique=True)
    first_name = models.CharField(_('first name'), max_length=150)
    last_name = models.CharField(_('last name'), max_length=150)
    patronymic = models.CharField(_('patronymic'), max_length=150, blank=True)
    role = models.CharField(_('role'), max_length=20, choices=ROLE_CHOICES, default='author')
    orcid_id = models.CharField(_('ORCID ID'), max_length=50, blank=True)
    affiliation = models.CharField(_('affiliation'), max_length=255)
    avatar_url = models.ImageField(_('avatar'), upload_to='avatars/', blank=True, null=True)
    telegram_username = models.CharField(_('telegram username'), max_length=100, blank=True)
    # Bildirishnomalarni Telegram botga ham yuborish (bot orqali kirilgan bo'lsa)
    telegram_notifications = models.BooleanField(_('telegram notifications'), default=True)
    
    # Gamification
    gamification_level = models.CharField(_('level'), max_length=50, default='Beginner')
    gamification_badges = models.JSONField(_('badges'), default=list)
    gamification_points = models.IntegerField(_('points'), default=0)
    
    # Reviewer specific fields
    specializations = models.JSONField(_('specializations'), default=list, blank=True)
    reviews_completed = models.IntegerField(_('reviews completed'), default=0)
    average_review_time = models.FloatField(_('average review time (days)'), default=0)
    acceptance_rate = models.FloatField(_('acceptance rate (%)'), default=0)
    
    # Telefon raqami egasiga tegishli ekani tasdiqlanganmi (Telegram kontakt ulashish orqali — bepul)
    phone_verified = models.BooleanField(_('phone verified'), default=False)
    phone_verified_at = models.DateTimeField(_('phone verified at'), null=True, blank=True)
    # Ommaviy oferta va maxfiylik siyosatiga rozilik (qaysi tahririga va qachon)
    terms_accepted_at = models.DateTimeField(_('terms accepted at'), null=True, blank=True)
    terms_version = models.CharField(_('terms version'), max_length=20, blank=True)

    # Status fields
    is_active = models.BooleanField(_('active'), default=True)
    is_staff = models.BooleanField(_('staff status'), default=False)
    date_joined = models.DateTimeField(_('date joined'), auto_now_add=True)
    # auto_now=True bo'lmasin: aks holda har qanday saqlashda "oxirgi kirish" yangilanardi.
    # Haqiqiy kirish vaqtini SIMPLE_JWT UPDATE_LAST_LOGIN yozadi.
    last_login = models.DateTimeField(_('last login'), blank=True, null=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name', 'affiliation']
    
    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        ordering = ['-date_joined']
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.phone})"
    
    def get_full_name(self):
        """Return full name with patronymic if available"""
        if self.patronymic:
            return f"{self.last_name} {self.first_name} {self.patronymic}"
        return f"{self.last_name} {self.first_name}"
    
    def add_points(self, points):
        """Add gamification points"""
        self.gamification_points += points
        self.save()
    
    def add_badge(self, badge):
        """Add a badge to user"""
        if badge not in self.gamification_badges:
            self.gamification_badges.append(badge)
            self.save()


class PhoneChallenge(models.Model):
    """
    Telegram orqali telefonni tasdiqlash / parolni tiklash uchun bir martalik kod.
    Kod t.me/<bot>?start=<prefiks>_<kod> havolasida boradi; bot foydalanuvchidan kontaktini ulashishni so'raydi.
    Telegram kontakt faqat egasi tomonidan yuborilganda (contact.user_id == yuboruvchi) qabul qilinadi.
    """

    PURPOSE_VERIFY = 'verify'
    PURPOSE_RESET = 'reset'          # parolni tiklash so'rovi (telefon bo'yicha)
    PURPOSE_RESET_LINK = 'reset_link'  # kontakt tasdiqlangach saytdagi bir martalik havola
    PURPOSE_CHOICES = (
        (PURPOSE_VERIFY, 'Telefonni tasdiqlash'),
        (PURPOSE_RESET, 'Parolni tiklash'),
        (PURPOSE_RESET_LINK, 'Parolni tiklash havolasi'),
    )

    code = models.CharField(max_length=64, unique=True, db_index=True)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='phone_challenges')
    phone = models.CharField(max_length=20, blank=True)
    telegram_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = _('Telefon tasdiqlash kodi')
        verbose_name_plural = _('Telefon tasdiqlash kodlari')
        indexes = [models.Index(fields=['purpose', 'created_at'])]

    def __str__(self):
        return f'{self.purpose}:{self.phone or self.user_id}'


class TelegramSession(models.Model):
    """Persistent JWT session for Telegram bot users (auto-login on return)."""

    telegram_id = models.BigIntegerField(unique=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='telegram_sessions')
    access_token = models.TextField()
    refresh_token = models.TextField()
    telegram_username = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Telegram session')
        verbose_name_plural = _('Telegram sessions')

    def __str__(self):
        return f'TG {self.telegram_id} → {self.user.phone}'
