from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework import serializers

from academics.models import StaffProfile
from accounts.models import Role


class SecurityStaffProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(write_only=True, required=False)

    user_username = serializers.CharField(source='user.username', read_only=True)
    user_first_name = serializers.CharField(source='user.first_name', read_only=True)
    user_last_name = serializers.CharField(source='user.last_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_roles = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = StaffProfile
        fields = [
            'id',
            'staff_id',
            'department',
            'designation',
            'status',
            'mobile_number',
            'mobile_number_verified_at',
            'profile_image',
            'rfid_uid',
            'username',
            'password',
            'first_name',
            'last_name',
            'email',
            'user_username',
            'user_first_name',
            'user_last_name',
            'user_email',
            'user_roles',
        ]
        read_only_fields = ['id', 'mobile_number_verified_at']

    def get_user_roles(self, obj):
        try:
            return [r.name for r in obj.user.roles.all()]
        except Exception:
            return []

    def _ensure_security_role(self, user):
        role, _ = Role.objects.get_or_create(name='SECURITY', defaults={'description': 'Security role'})
        user.roles.add(role)

    def create(self, validated_data):
        User = get_user_model()

        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        email = validated_data.pop('email', None)
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')

        if not username:
            raise serializers.ValidationError({'username': 'Username is required.'})
        if not password:
            raise serializers.ValidationError({'password': 'Password is required.'})
        if not email:
            raise serializers.ValidationError({'email': 'Email is required.'})

        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                )
                self._ensure_security_role(user)
                return StaffProfile.objects.create(user=user, **validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError({'detail': f'Unable to create security user: {exc}'})

    def update(self, instance, validated_data):
        User = get_user_model()

        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        email = validated_data.pop('email', None)
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)

        user = instance.user

        if username is not None:
            if User.objects.filter(username=username).exclude(pk=user.pk).exists():
                raise serializers.ValidationError({'username': 'A user with this username already exists.'})
            user.username = username

        if email is not None:
            if User.objects.filter(email=email).exclude(pk=user.pk).exists():
                raise serializers.ValidationError({'email': 'A user with this email already exists.'})
            user.email = email

        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        if password:
            user.set_password(password)

        with transaction.atomic():
            user.save()
            self._ensure_security_role(user)

            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

        return instance
