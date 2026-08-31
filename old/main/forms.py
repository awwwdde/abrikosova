from django import forms
from .models import ConsultationRequest


class ConsultationForm(forms.ModelForm):
    class Meta:
        model = ConsultationRequest
        fields = ['name', 'phone', 'description']
        widgets = {
            'name': forms.TextInput(attrs={
                'placeholder': 'Ваше имя',
                'class': 'form-input'
            }),
            'phone': forms.TextInput(attrs={
                'placeholder': 'Телефон',
                'class': 'form-input'
            }),
            'description': forms.Textarea(attrs={
                'placeholder': 'Расскажите о вашем торте: повод, количество персон, пожелания по дизайну...',
                'rows': 4,
                'class': 'form-textarea'
            }),
        }


