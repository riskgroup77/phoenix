from rest_framework import serializers
from .models import PeerReview


class PeerReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()
    article_title = serializers.SerializerMethodField()
    overall_score = serializers.SerializerMethodField()
    
    class Meta:
        model = PeerReview
        fields = '__all__'
        read_only_fields = ('id', 'assigned_at', 'reviewer')
    
    def get_reviewer_name(self, obj):
        return obj.reviewer.get_full_name()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        viewer = getattr(request, 'user', None)
        # Muallif o'z maqolasi taqrizini ko'rganda: yopiq taqrizda taqrizchi shaxsi va
        # tahririyatga yozilgan izoh ko'rsatilmaydi
        if viewer is not None and getattr(instance.article, 'author_id', None) == getattr(viewer, 'id', None):
            data.pop('comments_to_editor', None)
            if instance.review_type != 'open':
                data['reviewer'] = None
                data['reviewer_name'] = 'Anonim taqrizchi'
        return data
    
    def get_article_title(self, obj):
        return obj.article.title

    def get_overall_score(self, obj):
        return obj.overall_score
