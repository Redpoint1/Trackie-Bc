from rest_framework.serializers import (HyperlinkedModelSerializer,
                                        SerializerMethodField)
from ....serializers import ImageSerializer
from ......trackie.models import RacerInRace, Racer


class RacerSerializer(HyperlinkedModelSerializer):
    photo = ImageSerializer(
        sizes=[
            ('normal', 'url'),
            ('thumbnail', 'crop__150x200'),
        ],
        required=False
    )

    class Meta:
        model = Racer
        fields = ("id", "url", "first_name", "last_name", "photo",)


class RaceRacerSerializer(RacerSerializer):
    number = SerializerMethodField("get_num")

    def get_num(self, instance):
        item = self.context["view"].queryset[0].race
        racer_rel = RacerInRace.objects.get(racer=instance, race=item)
        return racer_rel.number

    class Meta(RacerSerializer.Meta):
        fields = ("id", "url", "first_name", "last_name", "photo", "number",)
